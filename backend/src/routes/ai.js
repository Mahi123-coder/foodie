import { Router } from 'express';

import Restaurant from '../models/Restaurant.js';
import MenuItem from '../models/MenuItem.js';

const router = Router();

router.post('/recommend', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({
        message: 'Please tell me what you are looking for.',
      });
    }

    const text = query.toLowerCase();

    const restaurants = await Restaurant.find({}).lean();
    const menuItems = await MenuItem.find({}).lean();

    const budgetMatch = text.match(
      /(?:under|below|within|less than|max(?:imum)?|budget of)\s*₹?\s*(\d+)/i
    );

    const budget = budgetMatch
      ? Number(budgetMatch[1])
      : null;

    const wantsVeg =
      text.includes('veg') ||
      text.includes('vegetarian');

    const wantsNonVeg =
      text.includes('non veg') ||
      text.includes('non-veg') ||
      text.includes('chicken') ||
      text.includes('mutton') ||
      text.includes('fish');

    const keywords = [
      'pizza',
      'burger',
      'indian',
      'north indian',
      'south indian',
      'chinese',
      'dessert',
      'healthy',
      'biryani',
      'pasta',
      'dosa',
      'noodles',
      'sandwich',
      'cake',
      'spicy',
      'sweet',
      'breakfast',
    ];

    const requestedKeywords = keywords.filter((keyword) =>
      text.includes(keyword)
    );

    const recommendations = [];

    for (const restaurant of restaurants) {
      const restaurantCuisine = (
        restaurant.cuisine || []
      )
        .join(' ')
        .toLowerCase();

      const restaurantText = `
        ${restaurant.name || ''}
        ${restaurantCuisine}
        ${restaurant.location || ''}
      `.toLowerCase();

      const restaurantMenu = menuItems.filter(
        (item) =>
          String(item.restaurant) ===
          String(restaurant._id)
      );

      for (const item of restaurantMenu) {
        const itemText = `
          ${item.name || ''}
          ${item.description || ''}
          ${restaurantText}
        `.toLowerCase();

        let score = 0;

        // Cuisine / food matching
        requestedKeywords.forEach((keyword) => {
          if (itemText.includes(keyword)) {
            score += 5;
          }
        });

        // Vegetarian preference
        if (wantsVeg) {
          if (item.isVeg === true) {
            score += 8;
          } else {
            score -= 10;
          }
        }

        // Non-vegetarian preference
        if (wantsNonVeg) {
          if (item.isVeg === false) {
            score += 7;
          }
        }

        // Budget
        if (budget) {
          if (item.price <= budget) {
            score += 8;
          } else {
            score -= 8;
          }
        }

        // Common preference words
        if (
          text.includes('spicy') &&
          itemText.includes('spicy')
        ) {
          score += 6;
        }

        if (
          text.includes('sweet') &&
          itemText.includes('sweet')
        ) {
          score += 6;
        }

        if (
          text.includes('healthy') &&
          itemText.includes('healthy')
        ) {
          score += 6;
        }

        if (
          text.includes('filling') &&
          (
            itemText.includes('biryani') ||
            itemText.includes('rice') ||
            itemText.includes('meal') ||
            itemText.includes('thali') ||
            itemText.includes('paneer') ||
            itemText.includes('chicken') ||
            itemText.includes('burger')
          )
        ) {
          score += 5;
        }

        // Rating bonus
        score += Number(restaurant.rating || 0);

        if (score > 0) {
          recommendations.push({
            restaurantId: restaurant._id,
            restaurantName: restaurant.name,
            menuItemId: item._id,
            menuItemName: item.name,
            price: item.price,
            reason: buildReason({
              item,
              restaurant,
              budget,
              wantsVeg,
              requestedKeywords,
            }),
            score,
          });
        }
      }
    }

    recommendations.sort(
      (a, b) => b.score - a.score
    );

    const topRecommendations =
      recommendations.slice(0, 5);

    if (topRecommendations.length === 0) {
      return res.json({
        message:
          "I couldn't find an exact match. Try something like 'Indian food under 400', 'vegetarian food', or 'pizza'. 🤔",
        recommendations: [],
      });
    }

    res.json({
      message:
        `I found ${topRecommendations.length} tasty option${
          topRecommendations.length > 1 ? 's' : ''
        } for you! 🍽️`,
      recommendations: topRecommendations.map(
        ({ score, ...item }) => item
      ),
    });
  } catch (error) {
    console.error(
      'AI recommendation error:',
      error
    );

    res.status(500).json({
      message:
        error.message ||
        'Could not generate recommendations.',
    });
  }
});

function buildReason({
  item,
  restaurant,
  budget,
  wantsVeg,
  requestedKeywords,
}) {
  const reasons = [];

  if (wantsVeg && item.isVeg === true) {
    reasons.push('vegetarian');
  }

  if (budget && item.price <= budget) {
    reasons.push(`within your ₹${budget} budget`);
  }

  if (requestedKeywords.length > 0) {
    const matched = requestedKeywords.find(
      (keyword) =>
        `${item.name} ${item.description || ''} ${
          restaurant.cuisine || ''
        }`
          .toLowerCase()
          .includes(keyword)
    );

    if (matched) {
      reasons.push(`${matched} preference`);
    }
  }

  if (reasons.length === 0) {
    reasons.push('a good match based on your request');
  }

  return `I picked this because it matches your ${reasons.join(
    ', '
  )}.`;
}

export default router;
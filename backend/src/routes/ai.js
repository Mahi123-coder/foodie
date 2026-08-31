import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

import Restaurant from '../models/Restaurant.js';
import MenuItem from '../models/MenuItem.js';

const router = Router();

// =============================================================
// GEMINI AI
// =============================================================

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn(
    'WARNING: GEMINI_API_KEY is not set in backend/.env'
  );
}

const ai = apiKey
  ? new GoogleGenAI({ apiKey })
  : null;


// =============================================================
// RECOMMENDATION ROUTE
// =============================================================

router.post('/recommend', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({
        message: 'Please tell me what you are looking for.',
      });
    }

    const text = query.toLowerCase().trim();

    // =========================================================
    // GET DATA
    // =========================================================

    const restaurants = await Restaurant.find({}).lean();
    const menuItems = await MenuItem.find({}).lean();

    // =========================================================
    // BUDGET
    // =========================================================

    const budgetMatch = text.match(
      /(?:under|below|within|less than|max(?:imum)?|budget of)\s*₹?\s*(\d+)/i
    );

    const budget = budgetMatch
      ? Number(budgetMatch[1])
      : null;


    // =========================================================
    // VEG / NON-VEG
    // =========================================================

    const wantsVeg =
      text.includes('veg') ||
      text.includes('vegetarian');

    const wantsNonVeg =
      text.includes('non veg') ||
      text.includes('non-veg') ||
      text.includes('chicken') ||
      text.includes('mutton') ||
      text.includes('fish');


    // =========================================================
    // FOOD KEYWORDS
    // =========================================================

    const keywords = [
      'pizza',
      'burger',
      'salad',
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
      'rice',
      'paneer',
      'chicken',
      'mutton',
      'fish',
      'thali',
      'meal',
      'wrap',
      'roll',
      'soup',
      'momos',
      'tandoori',
      'kebab',
      'shawarma',
      'fries',
      'ice cream',
      'coffee',
      'tea',
    ];

    const requestedKeywords = keywords.filter((keyword) =>
      text.includes(keyword)
    );


    // =========================================================
    // REQUIRED FOOD KEYWORDS
    // =========================================================
    //
    // These are actual food/category searches.
    // If the user searches one of these, unrelated food
    // should NOT be returned.
    //

    const requiredFoodKeywords = requestedKeywords.filter(
      (keyword) =>
        ![
          'spicy',
          'sweet',
          'healthy',
          'breakfast',
          'indian',
          'north indian',
          'south indian',
          'chinese',
          'dessert',
        ].includes(keyword)
    );


    const recommendations = [];


    // =========================================================
    // FIND MATCHES
    // =========================================================

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
        `.toLowerCase();


        // =====================================================
        // REQUIRED FOOD MATCH
        // =====================================================
        //
        // IMPORTANT:
        // Match the actual menu item first.
        // Do NOT use restaurant cuisine here because
        // "Indian restaurant" should not make every Indian
        // dish match a specific food search like "salad".
        //

        const matchedRequiredKeyword =
          requiredFoodKeywords.find((keyword) => {

            // Handle singular/plural searches.
            if (
              keyword === 'salad' &&
              (
                itemText.includes('salad') ||
                itemText.includes('salads')
              )
            ) {
              return true;
            }

            if (
              keyword === 'pizza' &&
              (
                itemText.includes('pizza') ||
                itemText.includes('pizzas')
              )
            ) {
              return true;
            }

            return itemText.includes(keyword);
          });


        // =====================================================
        // STRICT FOOD FILTER
        // =====================================================

        if (
          requiredFoodKeywords.length > 0 &&
          !matchedRequiredKeyword
        ) {
          continue;
        }


        // =====================================================
        // BUDGET FILTER
        // =====================================================

        if (
          budget !== null &&
          Number(item.price) > budget
        ) {
          continue;
        }


        // =====================================================
        // VEG FILTER
        // =====================================================

        if (
          wantsVeg &&
          item.isVeg !== true
        ) {
          continue;
        }


        // =====================================================
        // NON-VEG FILTER
        // =====================================================

        if (
          wantsNonVeg &&
          item.isVeg === true
        ) {
          continue;
        }


        // =====================================================
        // SCORING
        // =====================================================

        let score = 0;


        // Exact food match
        if (matchedRequiredKeyword) {
          score += 20;
        }


        // Budget
        if (budget !== null) {
          if (Number(item.price) <= budget) {
            score += 10;
          }
        }


        // Vegetarian
        if (
          wantsVeg &&
          item.isVeg === true
        ) {
          score += 10;
        }


        // Non vegetarian
        if (
          wantsNonVeg &&
          item.isVeg === false
        ) {
          score += 10;
        }


        // Spicy
        if (
          text.includes('spicy') &&
          (
            itemText.includes('spicy') ||
            itemText.includes('hot')
          )
        ) {
          score += 8;
        }


        // Sweet
        if (
          text.includes('sweet') &&
          (
            itemText.includes('sweet') ||
            itemText.includes('dessert')
          )
        ) {
          score += 8;
        }


        // Healthy
        if (
          text.includes('healthy') &&
          (
            itemText.includes('healthy') ||
            itemText.includes('salad') ||
            itemText.includes('grilled')
          )
        ) {
          score += 8;
        }


        // Breakfast
        if (
          text.includes('breakfast') &&
          (
            itemText.includes('breakfast') ||
            itemText.includes('dosa') ||
            itemText.includes('idli') ||
            itemText.includes('poha') ||
            itemText.includes('upma')
          )
        ) {
          score += 8;
        }


        // Filling
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
          score += 6;
        }


        // Restaurant rating
        score += Number(restaurant.rating || 0);


        // =====================================================
        // ADD RECOMMENDATION
        // =====================================================

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
            wantsNonVeg,
            requestedKeywords,
            matchedRequiredKeyword,
          }),

          score,
        });
      }
    }


    // =========================================================
    // SORT BY SCORE
    // =========================================================

    recommendations.sort(
      (a, b) => b.score - a.score
    );


    // =========================================================
    // REMOVE DUPLICATES
    // =========================================================

    const uniqueRecommendations = [];

    const seen = new Set();

    for (const recommendation of recommendations) {

      const key =
        `${recommendation.restaurantId}-${recommendation.menuItemId}`;

      if (!seen.has(key)) {

        seen.add(key);

        uniqueRecommendations.push(
          recommendation
        );
      }
    }


    // =========================================================
    // TOP 5
    // =========================================================

    const topRecommendations =
      uniqueRecommendations.slice(0, 5);


    // =========================================================
    // NO RESULTS
    // =========================================================

    if (topRecommendations.length === 0) {

      return res.json({
        message:
          `I couldn't find an exact match for "${query}". Try another food or preference. 🤔`,

        recommendations: [],
      });
    }


    // =========================================================
    // OPTIONAL GEMINI ENHANCEMENT
    // =========================================================

    let aiMessage = null;

    if (ai) {

      try {

        const recommendationSummary =
          topRecommendations
            .map(
              (item) =>
                `${item.restaurantName} - ${item.menuItemName} - ₹${item.price}`
            )
            .join('\n');


        const prompt = `
You are a helpful food recommendation assistant.

The user asked:
"${query}"

Here are the matching food options selected by the application's
database filtering system:

${recommendationSummary}

Write ONE short friendly sentence explaining why these options
are suitable for the user's request.

IMPORTANT:
- Do not invent any information.
- Do not mention dishes that are not in the list.
- Do not add restaurants that are not in the list.
- Do not add prices that are not in the list.
- Do not recommend additional food.
- Keep it natural and concise.
`;


        const response =
          await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
          });


        console.log(
          'GEMINI RESPONSE:',
          response.text
        );


        aiMessage =
          response.text?.trim() || null;

      } catch (geminiError) {

        console.error(
          'Gemini error:',
          geminiError.message
        );

        // If Gemini fails, the normal
        // recommendation system still works.
        aiMessage = null;
      }
    }


    // =========================================================
    // RESPONSE
    // =========================================================

    res.json({

      message:
        aiMessage ||
        `I found ${topRecommendations.length} tasty option${
          topRecommendations.length > 1
            ? 's'
            : ''
        } for you! 🍽️`,

      recommendations:
        topRecommendations.map(
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


// =============================================================
// REASON BUILDER
// =============================================================

function buildReason({
  item,
  restaurant,
  budget,
  wantsVeg,
  wantsNonVeg,
  requestedKeywords,
  matchedRequiredKeyword,
}) {

  const reasons = [];


  if (matchedRequiredKeyword) {

    reasons.push(
      `${matchedRequiredKeyword} preference`
    );
  }


  if (
    wantsVeg &&
    item.isVeg === true
  ) {

    reasons.push(
      'vegetarian'
    );
  }


  if (
    wantsNonVeg &&
    item.isVeg === false
  ) {

    reasons.push(
      'non-vegetarian'
    );
  }


  if (
    budget !== null &&
    Number(item.price) <= budget
  ) {

    reasons.push(
      `within your ₹${budget} budget`
    );
  }


  // =========================================================
  // PREFERENCE REASONS
  // =========================================================

  const description =
    `${item.name || ''} ${
      item.description || ''
    }`.toLowerCase();


  if (
    requestedKeywords.includes('spicy') &&
    (
      description.includes('spicy') ||
      description.includes('hot')
    )
  ) {

    reasons.push(
      'spicy preference'
    );
  }


  if (
    requestedKeywords.includes('sweet') &&
    (
      description.includes('sweet') ||
      description.includes('dessert')
    )
  ) {

    reasons.push(
      'sweet preference'
    );
  }


  if (
    requestedKeywords.includes('healthy') &&
    (
      description.includes('healthy') ||
      description.includes('salad') ||
      description.includes('grilled')
    )
  ) {

    reasons.push(
      'healthy preference'
    );
  }


  // =========================================================
  // DEFAULT REASON
  // =========================================================

  if (reasons.length === 0) {

    reasons.push(
      'a good match based on your request'
    );
  }


  return `I picked this because it matches your ${reasons.join(
    ', '
  )}.`;
}


export default router;
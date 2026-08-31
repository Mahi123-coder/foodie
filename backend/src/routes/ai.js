import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

import Restaurant from '../models/Restaurant.js';
import MenuItem from '../models/MenuItem.js';

const router = Router();


// =============================================================
// GEMINI AI
// =============================================================

function getGeminiAI() {
  const apiKey = process.env.GEMINI_API_KEY;

  console.log(
    'Gemini API key available:',
    Boolean(apiKey)
  );

  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({
    apiKey: apiKey.trim(),
  });
}


// =============================================================
// RECOMMENDATION ROUTE
// =============================================================

router.post('/recommend', async (req, res) => {

  try {

    console.log('======================================');
    console.log('AI RECOMMENDATION REQUEST RECEIVED');
    console.log('======================================');

    const { query } = req.body;


    // =========================================================
    // VALIDATE QUERY
    // =========================================================

    if (!query || !query.trim()) {

      return res.status(400).json({
        message:
          'Please tell me what you are looking for.',
        recommendations: [],
      });

    }


    // =========================================================
    // GET GEMINI CLIENT
    // =========================================================

    const ai = getGeminiAI();


    if (!ai) {

      console.error(
        'GEMINI_API_KEY IS NOT AVAILABLE AT REQUEST TIME'
      );

      return res.status(500).json({
        message:
          'Gemini AI is not configured on the backend. Please check GEMINI_API_KEY in Render Environment Variables.',
        recommendations: [],
      });

    }


    console.log(
      'Gemini AI client created successfully.'
    );


    // =========================================================
    // GET RESTAURANTS + MENU
    // =========================================================

    const restaurants =
      await Restaurant.find({}).lean();

    const menuItems =
      await MenuItem.find({}).lean();


    console.log(
      `Loaded ${restaurants.length} restaurants and ${menuItems.length} menu items.`
    );


    // =========================================================
    // CREATE FOOD DATABASE FOR GEMINI
    // =========================================================

    const availableFoods = [];


    for (const restaurant of restaurants) {

      const restaurantMenu =
        menuItems.filter(
          (item) =>
            String(item.restaurant) ===
            String(restaurant._id)
        );


      for (const item of restaurantMenu) {

        availableFoods.push({

          restaurantId:
            String(restaurant._id),

          restaurantName:
            restaurant.name,

          cuisine:
            restaurant.cuisine || [],

          restaurantRating:
            restaurant.rating || 0,

          restaurantLocation:
            restaurant.location || '',

          deliveryTime:
            restaurant.deliveryTime || null,

          priceForTwo:
            restaurant.priceForTwo || null,

          menuItemId:
            String(item._id),

          menuItemName:
            item.name,

          description:
            item.description || '',

          price:
            item.price,

          isVeg:
            item.isVeg,

          image:
            item.image || null,

        });

      }

    }


    // =========================================================
    // NO FOOD IN DATABASE
    // =========================================================

    if (availableFoods.length === 0) {

      return res.json({

        message:
          'There are no menu items available yet. Please add some dishes from the admin panel. 🍽️',

        recommendations: [],

      });

    }


    console.log(
      `Sending ${availableFoods.length} food items to Gemini.`
    );


    // =========================================================
    // CREATE DATABASE STRING
    // =========================================================

    const foodDatabase =
      JSON.stringify(
        availableFoods,
        null,
        2
      );


    // =========================================================
    // CREATE PROMPT
    // =========================================================

    const prompt = `

You are the AI food recommendation engine for a restaurant
ordering application.

The user is asking:

"${query}"

You have been given the complete list of restaurants and
menu items currently available in the application's database.

Your job is to understand the user's request and select the
best matching menu items from this database.

IMPORTANT RULES:

1. ONLY select menu items that appear in the database.

2. NEVER invent a restaurant.

3. NEVER invent a menu item.

4. NEVER invent a price.

5. NEVER invent a rating.

6. NEVER select a food item only because the restaurant's
   cuisine sounds similar.

7. If the user asks for salad, select actual menu items
   whose name or description indicates salad.

8. If the user asks for pizza, select actual pizza items.

9. If the user asks for vegetarian food, select items where
   isVeg is true.

10. If the user asks for non-vegetarian food, select items
    where isVeg is false.

11. Respect explicit budget requirements.

12. Understand natural language preferences such as:

    - healthy
    - spicy
    - sweet
    - filling
    - light
    - breakfast
    - dinner
    - vegetarian
    - non vegetarian
    - cheap
    - expensive
    - under a particular price

13. Prefer exact menu-item matches over generic restaurant
    cuisine matches.

14. Return up to 5 recommendations.

15. If there are no suitable matches, return an empty array.

16. Do not return duplicate menu items.

17. The "reason" must explain why the selected item matches
    the user's request.

18. Return ONLY valid JSON.

The JSON must have exactly this structure:

{
  "recommendations": [
    {
      "menuItemId": "DATABASE_MENU_ITEM_ID",
      "restaurantId": "DATABASE_RESTAURANT_ID",
      "reason": "Short explanation"
    }
  ],
  "message": "One short friendly sentence"
}

DATABASE:

${foodDatabase}

`;


    // =========================================================
    // CALL GEMINI
    // =========================================================

    let response;

    try {

      console.log(
        'Calling Gemini...'
      );

      response =
        await ai.models.generateContent({

          model:
            'gemini-3.6-flash',

          contents:
            prompt,

        });

      console.log(
        'Gemini response received successfully.'
      );

    } catch (geminiError) {

      console.error(
        '======================================'
      );

      console.error(
        'GEMINI API ERROR'
      );

      console.error(
        '======================================'
      );

      console.error(
        geminiError
      );

      return res.status(500).json({

        message:
          'Gemini API request failed. Please check the backend logs.',

        recommendations: [],

      });

    }


    // =========================================================
    // GET GEMINI TEXT
    // =========================================================

    const responseText =
      response?.text?.trim();


    console.log(
      'GEMINI RAW RESPONSE:',
      responseText
    );


    if (!responseText) {

      return res.status(500).json({

        message:
          'Gemini returned an empty response.',

        recommendations: [],

      });

    }


    // =========================================================
    // CLEAN JSON
    // =========================================================

    let aiResult;


    try {

      let cleanText =
        responseText;


      // Remove markdown code fences.

      if (
        cleanText.startsWith('```')
      ) {

        cleanText =
          cleanText
            .replace(
              /^```json\s*/i,
              ''
            )
            .replace(
              /^```\s*/i,
              ''
            )
            .replace(
              /\s*```$/i,
              ''
            )
            .trim();

      }


      aiResult =
        JSON.parse(
          cleanText
        );

    } catch (parseError) {

      console.error(
        'Gemini JSON parse error:',
        parseError
      );

      console.error(
        'Gemini response:',
        responseText
      );


      return res.status(500).json({

        message:
          'Gemini returned an invalid recommendation response. Please try again.',

        recommendations: [],

      });

    }


    // =========================================================
    // VALIDATE GEMINI RESPONSE
    // =========================================================

    if (
      !aiResult ||
      !Array.isArray(
        aiResult.recommendations
      )
    ) {

      return res.json({

        message:
          'I could not find suitable recommendations for your request. 🤔',

        recommendations: [],

      });

    }


    // =========================================================
    // VALIDATE IDS AGAINST DATABASE
    // =========================================================

    const validatedRecommendations = [];

    const seenMenuItems =
      new Set();


    for (
      const aiRecommendation
      of aiResult.recommendations
    ) {

      if (
        !aiRecommendation ||
        !aiRecommendation.menuItemId ||
        !aiRecommendation.restaurantId
      ) {

        continue;

      }


      const menuItem =
        menuItems.find(
          (item) =>
            String(item._id) ===
            String(
              aiRecommendation.menuItemId
            )
        );


      const restaurant =
        restaurants.find(
          (restaurant) =>
            String(restaurant._id) ===
            String(
              aiRecommendation.restaurantId
            )
        );


      // Invalid IDs

      if (
        !menuItem ||
        !restaurant
      ) {

        continue;

      }


      // Make sure the menu item belongs
      // to the selected restaurant.

      if (
        String(menuItem.restaurant) !==
        String(restaurant._id)
      ) {

        continue;

      }


      // Prevent duplicate menu items.

      const menuKey =
        String(menuItem._id);


      if (
        seenMenuItems.has(menuKey)
      ) {

        continue;

      }


      seenMenuItems.add(
        menuKey
      );


      // =======================================================
      // USE REAL DATABASE DATA
      // =======================================================

      validatedRecommendations.push({

        restaurantId:
          restaurant._id,

        restaurantName:
          restaurant.name,

        restaurantImage:
          restaurant.image || null,

        restaurantRating:
          restaurant.rating || 0,

        cuisine:
          restaurant.cuisine || [],

        location:
          restaurant.location || '',

        deliveryTime:
          restaurant.deliveryTime || null,

        priceForTwo:
          restaurant.priceForTwo || null,

        menuItemId:
          menuItem._id,

        menuItemName:
          menuItem.name,

        menuItemDescription:
          menuItem.description || '',

        price:
          menuItem.price,

        isVeg:
          menuItem.isVeg,

        reason:
          aiRecommendation.reason ||
          'This dish matches your request.',

      });

    }


    // =========================================================
    // NO VALID RESULTS
    // =========================================================

    if (
      validatedRecommendations.length === 0
    ) {

      return res.json({

        message:
          `I couldn't find a suitable match for "${query}". Try another food or preference. 🤔`,

        recommendations: [],

      });

    }


    // =========================================================
    // LIMIT TO 5
    // =========================================================

    const topRecommendations =
      validatedRecommendations.slice(
        0,
        5
      );


    // =========================================================
    // FINAL RESPONSE
    // =========================================================

    return res.json({

      message:
        aiResult.message ||
        `I found ${topRecommendations.length} great options for you! 🍽️`,

      recommendations:
        topRecommendations,

    });


  } catch (error) {

    console.error(
      '======================================'
    );

    console.error(
      'AI RECOMMENDATION ERROR'
    );

    console.error(
      '======================================'
    );

    console.error(
      error
    );


    return res.status(500).json({

      message:
        error.message ||
        'Could not generate recommendations.',

      recommendations: [],

    });

  }

});


export default router;
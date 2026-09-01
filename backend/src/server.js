import 'dotenv/config';

import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

import Restaurant from './models/Restaurant.js';
import MenuItem from '../models/MenuItem.js';

const router = Router();


// =============================================================
// GEMINI AI
// =============================================================

// IMPORTANT:
// Load the environment variable inside this file itself.
// This prevents the ESM import-order problem where
// server.js may not have loaded dotenv yet.

const apiKey = process.env.GEMINI_API_KEY?.trim();

console.log(
  'AI ROUTE - GEMINI_API_KEY configured:',
  Boolean(apiKey)
);

const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
    })
  : null;


// =============================================================
// RECOMMENDATION ROUTE
// =============================================================

router.post('/recommend', async (req, res) => {

  try {

    // =========================================================
    // VALIDATE GEMINI CONFIGURATION
    // =========================================================

    if (!ai) {

      console.error(
        'GEMINI_API_KEY is missing in the backend environment.'
      );

      return res.status(500).json({

        message:
          'Gemini AI is not configured on the backend. Please check GEMINI_API_KEY in Render Environment Variables.',

        recommendations: [],

      });

    }


    // =========================================================
    // GET USER QUERY
    // =========================================================

    const { query } = req.body;


    if (
      typeof query !== 'string' ||
      !query.trim()
    ) {

      return res.status(400).json({

        message:
          'Please tell me what you are looking for.',

        recommendations: [],

      });

    }


    const userQuery = query.trim();


    console.log(
      'AI recommendation request:',
      userQuery
    );


    // =========================================================
    // GET RESTAURANTS
    // =========================================================

    const restaurants =
      await Restaurant
        .find({})
        .lean();


    // =========================================================
    // GET MENU ITEMS
    // =========================================================

    const menuItems =
      await MenuItem
        .find({})
        .lean();


    console.log(
      'Restaurants found:',
      restaurants.length
    );

    console.log(
      'Menu items found:',
      menuItems.length
    );


    // =========================================================
    // CREATE FOOD DATABASE
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
    // NO MENU ITEMS
    // =========================================================

    if (
      availableFoods.length === 0
    ) {

      return res.json({

        message:
          'There are no menu items available yet. Please add some dishes from the admin panel. 🍽️',

        recommendations: [],

      });

    }


    console.log(
      'Available food items for AI:',
      availableFoods.length
    );


    // =========================================================
    // FOOD DATABASE FOR GEMINI
    // =========================================================

    const foodDatabase =
      JSON.stringify(
        availableFoods,
        null,
        2
      );


    // =========================================================
    // GEMINI PROMPT
    // =========================================================

    const prompt = `

You are the AI food recommendation engine for a restaurant
ordering application.

The user is asking:

"${userQuery}"

You must select food ONLY from the database provided below.

IMPORTANT RULES:

1. ONLY select menu items that actually exist in the database.

2. NEVER invent a restaurant.

3. NEVER invent a menu item.

4. NEVER invent a price.

5. NEVER invent a rating.

6. NEVER create IDs.

7. Use the exact menuItemId and restaurantId from the database.

8. A restaurant cuisine alone is NOT enough to consider a dish
   a match.

9. Prefer exact menu-item matches.

10. If the user asks for chicken, prefer dishes whose name or
    description actually contains or clearly refers to chicken.

11. If the user asks for pizza, select actual pizza menu items.

12. If the user asks for burgers, select actual burger items.

13. If the user asks for salad, select actual salad items.

14. If the user asks for vegetarian food, only select items where
    isVeg is true.

15. If the user asks for non-vegetarian food, only select items
    where isVeg is false.

16. Respect explicit price limits.

17. Understand natural language such as:
    healthy
    spicy
    sweet
    filling
    light
    breakfast
    lunch
    dinner
    vegetarian
    non vegetarian
    cheap
    expensive
    under a certain price

18. Do not recommend something merely because its restaurant
    cuisine is related to the query.

19. Return a maximum of 5 recommendations.

20. Do not return duplicate menu items.

21. If there are no suitable matches, return an empty array.

22. The reason must briefly explain why the item matches.

23. Return ONLY valid JSON.

Return exactly this structure:

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

      response =
        await ai.models.generateContent({

          // USER REQUESTED GEMINI 3.6 ONLY
          model: 'gemini-3.6-flash',

          contents: prompt,

        });

    } catch (geminiError) {

      console.error(
        '================================================'
      );

      console.error(
        'GEMINI API ERROR'
      );

      console.error(
        geminiError
      );

      console.error(
        '================================================'
      );


      return res.status(500).json({

        message:
          'Gemini AI could not process your request right now. Please try again.',

        recommendations: [],

      });

    }


    // =========================================================
    // GET GEMINI RESPONSE TEXT
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
    // PARSE JSON
    // =========================================================

    let aiResult;


    try {

      let cleanText =
        responseText;


      // Remove ```json
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
    // VALIDATE AI RESPONSE
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
    // VALIDATE IDs AGAINST MONGODB
    // =========================================================

    const validatedRecommendations = [];

    const seenMenuItems = new Set();


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


      // -------------------------------------------------------
      // FIND REAL MENU ITEM
      // -------------------------------------------------------

      const menuItem =
        menuItems.find(
          (item) =>
            String(item._id) ===
            String(
              aiRecommendation.menuItemId
            )
        );


      // -------------------------------------------------------
      // FIND REAL RESTAURANT
      // -------------------------------------------------------

      const restaurant =
        restaurants.find(
          (restaurant) =>
            String(restaurant._id) ===
            String(
              aiRecommendation.restaurantId
            )
        );


      // -------------------------------------------------------
      // INVALID IDS
      // -------------------------------------------------------

      if (
        !menuItem ||
        !restaurant
      ) {

        console.warn(
          'AI returned invalid database ID:',
          aiRecommendation
        );

        continue;

      }


      // -------------------------------------------------------
      // VERIFY RELATIONSHIP
      // -------------------------------------------------------

      if (
        String(menuItem.restaurant) !==
        String(restaurant._id)
      ) {

        console.warn(
          'AI selected menu item from wrong restaurant.'
        );

        continue;

      }


      // -------------------------------------------------------
      // DUPLICATE CHECK
      // -------------------------------------------------------

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
          typeof aiRecommendation.reason === 'string'
            ? aiRecommendation.reason
            : 'This dish matches your request.',

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
          `I couldn't find a suitable match for "${userQuery}". Try another food or preference. 🤔`,

        recommendations: [],

      });

    }


    // =========================================================
    // MAXIMUM 5
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
        typeof aiResult.message === 'string'
          ? aiResult.message
          : `I found ${topRecommendations.length} great options for you! 🍽️`,

      recommendations:
        topRecommendations,

    });

  } catch (error) {

    console.error(
      'AI recommendation error:',
      error
    );


    return res.status(500).json({

      message:
        error?.message ||
        'Could not generate recommendations.',

      recommendations: [],

    });

  }

});


export default router;
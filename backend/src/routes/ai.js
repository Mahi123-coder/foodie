import 'dotenv/config';
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

  if (!apiKey || !apiKey.trim()) {
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

    // ---------------------------------------------------------
    // GET QUERY
    // ---------------------------------------------------------

    const { query } = req.body;

    if (
      typeof query !== 'string' ||
      !query.trim()
    ) {
      return res.status(400).json({
        message: 'Please tell me what you are looking for.',
        recommendations: [],
      });
    }


    // ---------------------------------------------------------
    // GET GEMINI
    // ---------------------------------------------------------

    const ai = getGeminiAI();

    console.log(
      'AI recommendation request received'
    );

    console.log(
      'Gemini API key available:',
      Boolean(process.env.GEMINI_API_KEY)
    );


    if (!ai) {
      console.error(
        'GEMINI_API_KEY is missing inside ai.js'
      );

      return res.status(500).json({
        message:
          'Gemini AI is not configured on the backend. Please check GEMINI_API_KEY in Render Environment Variables.',
        recommendations: [],
      });
    }


    // =========================================================
    // GET RESTAURANTS
    // =========================================================

    const restaurants =
      await Restaurant.find({}).lean();


    // =========================================================
    // GET MENU ITEMS
    // =========================================================

    const menuItems =
      await MenuItem.find({}).lean();


    // =========================================================
    // CREATE AVAILABLE FOOD DATABASE
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

    if (availableFoods.length === 0) {

      return res.json({

        message:
          'There are no menu items available yet. Please add some dishes from the admin panel. 🍽️',

        recommendations: [],

      });

    }


    // =========================================================
    // FOOD DATABASE
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

USER REQUEST:
"${query.trim()}"

You have access to the following restaurants and menu items
from the application's database.

DATABASE:
${foodDatabase}

IMPORTANT RULES:

1. ONLY recommend menu items that exist in the DATABASE.

2. NEVER invent a restaurant.

3. NEVER invent a menu item.

4. NEVER invent a price.

5. NEVER invent a rating.

6. NEVER create IDs.

7. Use the exact menuItemId and restaurantId from the DATABASE.

8. The menu item must actually belong to the selected restaurant.

9. Prefer exact menu-item matches.

10. Do not recommend an item only because the restaurant
    cuisine sounds appropriate.

11. If the user asks for chicken, recommend actual menu items
    whose name or description indicates chicken.

12. If the user asks for pizza, recommend actual pizza items.

13. If the user asks for burgers, recommend actual burger items.

14. If the user asks for vegetarian food, only recommend items
    where isVeg is true.

15. If the user asks for non-vegetarian food, recommend items
    where isVeg is false.

16. Respect explicit price requirements.

17. Understand natural language preferences such as:
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

18. Do not assume a dish is healthy unless its name or
    description provides reasonable evidence.

19. Do not assume a dish is spicy unless its name or
    description provides reasonable evidence.

20. Return at most 5 recommendations.

21. Do not return duplicate menu items.

22. If nothing matches, return an empty recommendations array.

23. The reason must briefly explain why the dish matches
    the user's request.

24. Return ONLY valid JSON.

Return EXACTLY this structure:

{
  "recommendations": [
    {
      "menuItemId": "DATABASE_MENU_ITEM_ID",
      "restaurantId": "DATABASE_RESTAURANT_ID",
      "reason": "Short explanation"
    }
  ],
  "message": "Short friendly sentence"
}
`;


    // =========================================================
    // CALL GEMINI 3.6 FLASH
    // =========================================================

    let response;

    try {

      response =
        await ai.models.generateContent({

          model: 'gemini-3.6-flash',

          contents: prompt,

        });

    } catch (geminiError) {

      console.error(
        'Gemini API request failed:'
      );

      console.error(
        geminiError
      );

      return res.status(500).json({

        message:
          'Gemini AI could not process your request right now. Please try again.',

        recommendations: [],

      });

    }


    // =========================================================
    // GET RESPONSE TEXT
    // =========================================================

    const responseText =
      response.text?.trim();


    console.log(
      'Gemini response received:',
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
        responseText.trim();


      // Remove ```json ... ``` if returned

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
        'Raw Gemini response:',
        responseText
      );


      return res.status(500).json({

        message:
          'Gemini returned an invalid recommendation response. Please try again.',

        recommendations: [],

      });

    }


    // =========================================================
    // VALIDATE RESPONSE
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
    // VALIDATE RECOMMENDATIONS AGAINST MONGODB
    // =========================================================

    const validatedRecommendations = [];

    const seenMenuItems =
      new Set();


    for (
      const recommendation
      of aiResult.recommendations
    ) {

      if (
        !recommendation ||
        !recommendation.menuItemId ||
        !recommendation.restaurantId
      ) {
        continue;
      }


      // -------------------------------------------------------
      // FIND MENU ITEM
      // -------------------------------------------------------

      const menuItem =
        menuItems.find(
          (item) =>
            String(item._id) ===
            String(
              recommendation.menuItemId
            )
        );


      // -------------------------------------------------------
      // FIND RESTAURANT
      // -------------------------------------------------------

      const restaurant =
        restaurants.find(
          (item) =>
            String(item._id) ===
            String(
              recommendation.restaurantId
            )
        );


      // -------------------------------------------------------
      // INVALID IDS
      // -------------------------------------------------------

      if (
        !menuItem ||
        !restaurant
      ) {
        continue;
      }


      // -------------------------------------------------------
      // VERIFY RELATIONSHIP
      // -------------------------------------------------------

      if (
        String(menuItem.restaurant) !==
        String(restaurant._id)
      ) {
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


      // -------------------------------------------------------
      // RETURN REAL DATABASE DATA
      // -------------------------------------------------------

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
          typeof recommendation.reason === 'string'
            ? recommendation.reason
            : 'This dish matches your request.',

      });


      // Maximum 5

      if (
        validatedRecommendations.length >= 5
      ) {
        break;
      }

    }


    // =========================================================
    // NO VALID RESULTS
    // =========================================================

    if (
      validatedRecommendations.length === 0
    ) {

      return res.json({

        message:
          `I couldn't find a suitable match for "${query.trim()}". Try another food or preference. 🤔`,

        recommendations: [],

      });

    }


    // =========================================================
    // SUCCESS
    // =========================================================

    return res.json({

      message:
        typeof aiResult.message === 'string' &&
        aiResult.message.trim()
          ? aiResult.message
          : `I found ${validatedRecommendations.length} great options for you! 🍽️`,

      recommendations:
        validatedRecommendations,

    });

  } catch (error) {

    console.error(
      'AI recommendation route error:',
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
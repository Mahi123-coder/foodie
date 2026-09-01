import 'dotenv/config';
import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

import Restaurant from '../models/Restaurant.js';
import MenuItem from '../models/MenuItem.js';

const router = Router();


// =============================================================
// CONFIG
// =============================================================

const GEMINI_MODEL = 'gemini-3.6-flash';


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
// HELPERS
// =============================================================

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .trim();
}


function foodText(item) {
  return [
    item.name,
    item.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}


function isVegItem(item) {
  return item.isVeg === true;
}


function isNonVegItem(item) {
  return item.isVeg === false;
}


// =============================================================
// KEYWORD DETECTION
// =============================================================

function detectPreferences(query) {

  const text = normalizeText(query);

  return {

    chicken:
      /\bchicken\b/i.test(text),

    mutton:
      /\bmutton\b|\blamb\b/i.test(text),

    fish:
      /\bfish\b|\bsalmon\b|\btuna\b/i.test(text),

    seafood:
      /\bseafood\b|\bprawn\b|\bprawns\b|\bshrimp\b|\bcrab\b/i.test(text),

    pizza:
      /\bpizza\b/i.test(text),

    burger:
      /\bburger\b|\bburgers\b/i.test(text),

    pasta:
      /\bpasta\b/i.test(text),

    biryani:
      /\bbiryani\b/i.test(text),

    salad:
      /\bsalad\b/i.test(text),

    vegetarian:
      /\bvegetarian\b|\bveg\b|\bveggie\b/i.test(text),

    nonVegetarian:
      /\bnon[- ]?veg\b|\bnon[- ]?vegetarian\b|\bnonveg\b/i.test(text),

    spicy:
      /\bspicy\b|\bhot\b|\bfiery\b/i.test(text),

    healthy:
      /\bhealthy\b|\bhealthier\b|\bnutritious\b/i.test(text),

    lowCarb:
      /\blow[- ]?carb\b|\blow carbohydrates\b|\bless carbs\b/i.test(text),

    highProtein:
      /\bhigh[- ]?protein\b|\bhigh protein\b|\bprotein rich\b|\bprotein-rich\b/i.test(text),

    sweet:
      /\bsweet\b|\bdessert\b|\bdesserts\b/i.test(text),

    breakfast:
      /\bbreakfast\b/i.test(text),

    lunch:
      /\blunch\b/i.test(text),

    dinner:
      /\bdinner\b/i.test(text),

    cheap:
      /\bcheap\b|\baffordable\b|\bbudget\b|\binexpensive\b/i.test(text),

    expensive:
      /\bexpensive\b|\bpremium\b|\bluxury\b/i.test(text),

    light:
      /\blight\b|\blighter\b/i.test(text),

    filling:
      /\bfilling\b|\bheavy\b/i.test(text),
  };
}


// =============================================================
// LOCAL MATCHING
// =============================================================

function matchesStrongKeyword(item, preferences) {

  const text = foodText(item);

  if (
    preferences.chicken &&
    !/\bchicken\b/i.test(text)
  ) {
    return false;
  }

  if (
    preferences.mutton &&
    !/\bmutton\b|\blamb\b/i.test(text)
  ) {
    return false;
  }

  if (
    preferences.fish &&
    !/\bfish\b|\bsalmon\b|\btuna\b/i.test(text)
  ) {
    return false;
  }

  if (
    preferences.seafood &&
    !/\bseafood\b|\bprawn\b|\bprawns\b|\bshrimp\b|\bcrab\b/i.test(text)
  ) {
    return false;
  }

  if (
    preferences.pizza &&
    !/\bpizza\b/i.test(text)
  ) {
    return false;
  }

  if (
    preferences.burger &&
    !/\bburger\b/i.test(text)
  ) {
    return false;
  }

  if (
    preferences.pasta &&
    !/\bpasta\b/i.test(text)
  ) {
    return false;
  }

  if (
    preferences.biryani &&
    !/\bbiryani\b/i.test(text)
  ) {
    return false;
  }

  if (
    preferences.salad &&
    !/\bsalad\b/i.test(text)
  ) {
    return false;
  }

  if (
    preferences.vegetarian &&
    !isVegItem(item)
  ) {
    return false;
  }

  if (
    preferences.nonVegetarian &&
    !isNonVegItem(item)
  ) {
    return false;
  }

  return true;
}


// =============================================================
// LOCAL SCORE
// =============================================================

function calculateScore(item, query, preferences) {

  const text = foodText(item);

  const queryWords =
    normalizeText(query)
      .split(/\s+/)
      .filter(
        (word) =>
          word.length >= 3
      );

  let score = 0;


  // -----------------------------------------------------------
  // Exact query words
  // -----------------------------------------------------------

  for (const word of queryWords) {

    if (text.includes(word)) {
      score += 10;
    }
  }


  // -----------------------------------------------------------
  // Strong food matches
  // -----------------------------------------------------------

  if (
    preferences.chicken &&
    /\bchicken\b/i.test(text)
  ) {
    score += 50;
  }

  if (
    preferences.mutton &&
    /\bmutton\b|\blamb\b/i.test(text)
  ) {
    score += 50;
  }

  if (
    preferences.fish &&
    /\bfish\b|\bsalmon\b|\btuna\b/i.test(text)
  ) {
    score += 50;
  }

  if (
    preferences.seafood &&
    /\bprawn\b|\bprawns\b|\bshrimp\b|\bcrab\b|\bseafood\b/i.test(text)
  ) {
    score += 50;
  }

  if (
    preferences.pizza &&
    /\bpizza\b/i.test(text)
  ) {
    score += 50;
  }

  if (
    preferences.burger &&
    /\bburger\b/i.test(text)
  ) {
    score += 50;
  }

  if (
    preferences.pasta &&
    /\bpasta\b/i.test(text)
  ) {
    score += 50;
  }

  if (
    preferences.biryani &&
    /\bbiryani\b/i.test(text)
  ) {
    score += 50;
  }

  if (
    preferences.salad &&
    /\bsalad\b/i.test(text)
  ) {
    score += 50;
  }


  // -----------------------------------------------------------
  // Protein
  // -----------------------------------------------------------

  if (preferences.highProtein) {

    if (
      /\bchicken\b|\begg\b|\beggs\b|\bfish\b|\btuna\b|\bprawn\b|\bshrimp\b|\bsteak\b|\bpaneer\b/i.test(text)
    ) {
      score += 30;
    }

    if (
      /\bprotein\b|\bhigh protein\b|\bprotein-rich\b/i.test(text)
    ) {
      score += 30;
    }
  }


  // -----------------------------------------------------------
  // Low carb
  // -----------------------------------------------------------

  if (preferences.lowCarb) {

    if (
      /\bsalad\b|\bgrilled\b|\bgrill\b|\bchicken\b|\begg\b|\beggs\b|\bfish\b|\bsteak\b/i.test(text)
    ) {
      score += 25;
    }

    if (
      /\bbread\b|\bbun\b|\bpasta\b|\brice\b|\bnoodles\b|\bwrap\b|\bfries\b|\bpotato\b/i.test(text)
    ) {
      score -= 15;
    }
  }


  // -----------------------------------------------------------
  // Healthy
  // -----------------------------------------------------------

  if (preferences.healthy) {

    if (
      /\bsalad\b|\bgrilled\b|\bsteamed\b|\bfresh\b|\bhealthy\b|\bprotein\b|\bvegetable\b|\bveggie\b/i.test(text)
    ) {
      score += 20;
    }
  }


  // -----------------------------------------------------------
  // Spicy
  // -----------------------------------------------------------

  if (preferences.spicy) {

    if (
      /\bspicy\b|\bhot\b|\bchilli\b|\bchili\b|\bfiery\b|\bmasala\b/i.test(text)
    ) {
      score += 25;
    }
  }


  // -----------------------------------------------------------
  // Sweet
  // -----------------------------------------------------------

  if (preferences.sweet) {

    if (
      /\bcake\b|\bpastry\b|\bice cream\b|\bicecream\b|\bdessert\b|\bbrownie\b|\bsweet\b|\bcookie\b|\bdonut\b|\bdoughnut\b/i.test(text)
    ) {
      score += 40;
    }
  }


  // -----------------------------------------------------------
  // Filling
  // -----------------------------------------------------------

  if (preferences.filling) {

    if (
      /\bbiryani\b|\bburger\b|\bpizza\b|\bthali\b|\bmeal\b|\bwrap\b|\broll\b|\bpasta\b/i.test(text)
    ) {
      score += 20;
    }
  }


  // -----------------------------------------------------------
  // Light
  // -----------------------------------------------------------

  if (preferences.light) {

    if (
      /\bsalad\b|\bsoup\b|\bgrilled\b|\bfresh\b/i.test(text)
    ) {
      score += 20;
    }

    if (
      /\bburger\b|\bpizza\b|\bbiryani\b|\bfries\b/i.test(text)
    ) {
      score -= 10;
    }
  }


  // -----------------------------------------------------------
  // Price
  // -----------------------------------------------------------

  if (
    preferences.cheap &&
    typeof item.price === 'number'
  ) {

    if (item.price <= 300) {
      score += 20;
    } else if (item.price <= 500) {
      score += 10;
    } else {
      score -= 10;
    }
  }


  if (
    preferences.expensive &&
    typeof item.price === 'number'
  ) {

    if (item.price >= 700) {
      score += 20;
    }
  }


  return score;
}


// =============================================================
// CREATE RESTAURANT MAP
// =============================================================

function createRestaurantMap(restaurants) {

  const map = new Map();

  for (const restaurant of restaurants) {

    map.set(
      String(restaurant._id),
      restaurant
    );
  }

  return map;
}


// =============================================================
// CREATE AVAILABLE FOODS
// =============================================================

function createAvailableFoods(
  restaurants,
  menuItems
) {

  const restaurantMap =
    createRestaurantMap(
      restaurants
    );

  const availableFoods = [];

  for (const item of menuItems) {

    const restaurant =
      restaurantMap.get(
        String(item.restaurant)
      );

    if (!restaurant) {
      continue;
    }

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

  return availableFoods;
}


// =============================================================
// GET LOCAL CANDIDATES
// =============================================================

function getCandidates(
  availableFoods,
  query
) {

  const preferences =
    detectPreferences(query);


  // -----------------------------------------------------------
  // First: strong filtering
  // -----------------------------------------------------------

  const hasStrongPreference =
    preferences.chicken ||
    preferences.mutton ||
    preferences.fish ||
    preferences.seafood ||
    preferences.pizza ||
    preferences.burger ||
    preferences.pasta ||
    preferences.biryani ||
    preferences.salad ||
    preferences.vegetarian ||
    preferences.nonVegetarian;


  let candidates;


  if (hasStrongPreference) {

    candidates =
      availableFoods.filter(
        (item) =>
          matchesStrongKeyword(
            item,
            preferences
          )
      );

  } else {

    candidates =
      [...availableFoods];
  }


  // -----------------------------------------------------------
  // Score candidates
  // -----------------------------------------------------------

  candidates =
    candidates
      .map((item) => ({
        item,

        score:
          calculateScore(
            item,
            query,
            preferences
          ),
      }))
      .sort(
        (a, b) =>
          b.score - a.score
      );


  // -----------------------------------------------------------
  // If strong filtering returned nothing,
  // fallback to all items.
  // -----------------------------------------------------------

  if (
    candidates.length === 0
  ) {

    candidates =
      availableFoods
        .map((item) => ({
          item,

          score:
            calculateScore(
              item,
              query,
              preferences
            ),
        }))
        .sort(
          (a, b) =>
            b.score - a.score
        );
  }


  // -----------------------------------------------------------
  // Only send a SMALL number to Gemini
  // -----------------------------------------------------------

  return candidates
    .slice(0, 15)
    .map(
      ({ item }) =>
        item
    );
}


// =============================================================
// GEMINI RECOMMENDATION
// =============================================================

async function askGemini(
  ai,
  query,
  candidates
) {

  const candidateDatabase =
    candidates.map(
      (item) => ({

        menuItemId:
          item.menuItemId,

        restaurantId:
          item.restaurantId,

        restaurantName:
          item.restaurantName,

        menuItemName:
          item.menuItemName,

        description:
          item.description,

        price:
          item.price,

        isVeg:
          item.isVeg,

        cuisine:
          item.cuisine,

        rating:
          item.restaurantRating,

      })
    );


  const prompt = `
You are a fast food recommendation engine.

USER REQUEST:
"${query.trim()}"

CANDIDATE MENU ITEMS:
${JSON.stringify(candidateDatabase)}

Rules:

1. ONLY choose items from the candidate list.

2. NEVER invent a restaurant.

3. NEVER invent a menu item.

4. NEVER invent an ID.

5. NEVER invent a price.

6. Use the exact menuItemId from the candidate list.

7. Use the exact restaurantId from the candidate list.

8. Recommend at most 5 items.

9. Do not duplicate menu items.

10. If the request says vegetarian, choose only isVeg=true.

11. If the request says non-vegetarian, choose only isVeg=false.

12. Match the user's request using the menu item name and description.

13. Do not claim something is healthy, spicy, high-protein,
low-carb, etc. unless the item name or description reasonably
supports that claim.

14. Keep each reason short.

15. If nothing matches, return an empty recommendations array.

Return JSON only.
`;


  const response =
    await ai.models.generateContent({

      model:
        GEMINI_MODEL,

      contents:
        prompt,

      config: {

        responseMimeType:
          'application/json',

        responseSchema: {

          type: 'object',

          properties: {

            recommendations: {

              type: 'array',

              items: {

                type: 'object',

                properties: {

                  menuItemId: {
                    type: 'string',
                  },

                  restaurantId: {
                    type: 'string',
                  },

                  reason: {
                    type: 'string',
                  },

                },

                required: [
                  'menuItemId',
                  'restaurantId',
                  'reason',
                ],
              },
            },

            message: {
              type: 'string',
            },

          },

          required: [
            'recommendations',
            'message',
          ],
        },

        // IMPORTANT:
        // This is a food recommender, not a complex reasoning task.
        // Lower thinking reduces latency.
        thinkingConfig: {
          thinkingLevel: 'low',
        },

        // Prevent unnecessarily long responses.
        maxOutputTokens: 800,

      },
    });


  const responseText =
    response.text?.trim();


  if (!responseText) {
    throw new Error(
      'Gemini returned an empty response.'
    );
  }


  return JSON.parse(
    responseText
  );
}


// =============================================================
// RECOMMENDATION ROUTE
// =============================================================

router.post(
  '/recommend',
  async (req, res) => {

    const requestStart =
      Date.now();


    try {

      // =======================================================
      // GET QUERY
      // =======================================================

      const { query } =
        req.body;


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


      const cleanQuery =
        query.trim();


      console.log(
        '\n======================================'
      );

      console.log(
        'AI recommendation request:',
        cleanQuery
      );

      console.log(
        '======================================'
      );


      // =======================================================
      // GET GEMINI
      // =======================================================

      const ai =
        getGeminiAI();


      console.log(
        'Gemini API key available:',
        Boolean(
          process.env.GEMINI_API_KEY
        )
      );


      if (!ai) {

        console.error(
          'GEMINI_API_KEY is missing.'
        );

        return res.status(500).json({

          message:
            'Gemini AI is not configured on the backend. Please check GEMINI_API_KEY in Render Environment Variables.',

          recommendations: [],

        });
      }


      // =======================================================
      // LOAD DATABASE
      // =======================================================

      console.time(
        'MongoDB restaurants'
      );

      const restaurants =
        await Restaurant
          .find({})
          .lean();

      console.timeEnd(
        'MongoDB restaurants'
      );


      console.time(
        'MongoDB menu items'
      );

      const menuItems =
        await MenuItem
          .find({})
          .lean();

      console.timeEnd(
        'MongoDB menu items'
      );


      console.log(
        'Restaurants:',
        restaurants.length
      );

      console.log(
        'Menu items:',
        menuItems.length
      );


      // =======================================================
      // NO MENU
      // =======================================================

      if (
        menuItems.length === 0
      ) {

        return res.json({

          message:
            'There are no menu items available yet. Please add some dishes from the admin panel. 🍽️',

          recommendations: [],

        });
      }


      // =======================================================
      // BUILD AVAILABLE FOODS
      // =======================================================

      console.time(
        'Build available foods'
      );

      const availableFoods =
        createAvailableFoods(
          restaurants,
          menuItems
        );

      console.timeEnd(
        'Build available foods'
      );


      console.log(
        'Available foods:',
        availableFoods.length
      );


      if (
        availableFoods.length === 0
      ) {

        return res.json({

          message:
            'There are no valid menu items connected to restaurants yet. Please check your menu data. 🍽️',

          recommendations: [],

        });
      }


      // =======================================================
      // LOCAL CANDIDATE SEARCH
      // =======================================================

      console.time(
        'Local candidate search'
      );

      const candidates =
        getCandidates(
          availableFoods,
          cleanQuery
        );

      console.timeEnd(
        'Local candidate search'
      );


      console.log(
        'Candidates sent to Gemini:',
        candidates.length
      );


      // =======================================================
      // IF NO CANDIDATES
      // =======================================================

      if (
        candidates.length === 0
      ) {

        return res.json({

          message:
            `I couldn't find a suitable match for "${cleanQuery}". Try another food or preference. 🤔`,

          recommendations: [],

        });
      }


      // =======================================================
      // GEMINI
      // =======================================================

      console.time(
        'Gemini API'
      );


      let aiResult;


      try {

        aiResult =
          await askGemini(
            ai,
            cleanQuery,
            candidates
          );

      } catch (geminiError) {

        console.timeEnd(
          'Gemini API'
        );


        console.error(
          'Gemini API error:'
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


      console.timeEnd(
        'Gemini API'
      );


      console.log(
        'Gemini response:',
        aiResult
      );


      // =======================================================
      // VALIDATE AI RESPONSE
      // =======================================================

      console.time(
        'Validate recommendations'
      );


      if (
        !aiResult ||
        !Array.isArray(
          aiResult.recommendations
        )
      ) {

        console.timeEnd(
          'Validate recommendations'
        );


        return res.json({

          message:
            'I could not find suitable recommendations for your request. 🤔',

          recommendations: [],

        });
      }


      // -------------------------------------------------------
      // Create maps for O(1) lookup
      // -------------------------------------------------------

      const menuMap =
        new Map();

      for (
        const item
        of menuItems
      ) {

        menuMap.set(
          String(item._id),
          item
        );
      }


      const restaurantMap =
        createRestaurantMap(
          restaurants
        );


      const validatedRecommendations =
        [];

      const seenMenuItems =
        new Set();


      // =======================================================
      // VALIDATE EACH RESULT
      // =======================================================

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


        const menuItem =
          menuMap.get(
            String(
              recommendation.menuItemId
            )
          );


        const restaurant =
          restaurantMap.get(
            String(
              recommendation.restaurantId
            )
          );


        // -----------------------------------------------------
        // INVALID IDS
        // -----------------------------------------------------

        if (
          !menuItem ||
          !restaurant
        ) {
          continue;
        }


        // -----------------------------------------------------
        // VERIFY RELATIONSHIP
        // -----------------------------------------------------

        if (
          String(
            menuItem.restaurant
          ) !==
          String(
            restaurant._id
          )
        ) {
          continue;
        }


        // -----------------------------------------------------
        // DUPLICATE
        // -----------------------------------------------------

        const menuKey =
          String(
            menuItem._id
          );


        if (
          seenMenuItems.has(
            menuKey
          )
        ) {
          continue;
        }


        seenMenuItems.add(
          menuKey
        );


        // -----------------------------------------------------
        // RETURN REAL DATABASE DATA
        // -----------------------------------------------------

        validatedRecommendations.push({

          restaurantId:
            restaurant._id,

          restaurantName:
            restaurant.name,

          restaurantImage:
            restaurant.image ||
            null,

          restaurantRating:
            restaurant.rating ||
            0,

          cuisine:
            restaurant.cuisine ||
            [],

          location:
            restaurant.location ||
            '',

          deliveryTime:
            restaurant.deliveryTime ||
            null,

          priceForTwo:
            restaurant.priceForTwo ||
            null,

          menuItemId:
            menuItem._id,

          menuItemName:
            menuItem.name,

          menuItemDescription:
            menuItem.description ||
            '',

          price:
            menuItem.price,

          isVeg:
            menuItem.isVeg,

          reason:
            typeof recommendation.reason === 'string'
              ? recommendation.reason
              : 'This dish matches your request.',

        });


        if (
          validatedRecommendations.length >= 5
        ) {
          break;
        }
      }


      console.timeEnd(
        'Validate recommendations'
      );


      // =======================================================
      // NO VALID RESULTS
      // =======================================================

      if (
        validatedRecommendations.length === 0
      ) {

        return res.json({

          message:
            `I couldn't find a suitable match for "${cleanQuery}". Try another food or preference. 🤔`,

          recommendations: [],

        });
      }


      // =======================================================
      // SUCCESS
      // =======================================================

      const totalTime =
        Date.now() -
        requestStart;


      console.log(
        `Total AI request time: ${totalTime} ms`
      );


      console.log(
        'Recommendations returned:',
        validatedRecommendations.length
      );


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
        'AI recommendation route error:'
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
  }
);


// =============================================================
// EXPORT
// =============================================================

export default router;
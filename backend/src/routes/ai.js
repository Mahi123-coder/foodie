import 'dotenv/config';
import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

import Restaurant from '../models/Restaurant.js';
import MenuItem from '../models/MenuItem.js';
import Order from '../models/Order.js';

const router = Router();

// =============================================================
// CONFIG
// =============================================================

// Fast models first.
// If one is unavailable, overloaded, rate-limited, or times out,
// the backend automatically tries the next model.
const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
];

// Primary model
const GEMINI_MODEL = GEMINI_MODELS[0];

// =============================================================
// GEMINI AI CLIENT
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
// GEMINI ERROR CLASSIFICATION
// =============================================================

function isFallbackEligibleError(error) {
  const message = String(
    error?.message || error || ''
  ).toLowerCase();

  return (
    // Temporary availability problems
    message.includes('503') ||
    message.includes('429') ||
    message.includes('unavailable') ||
    message.includes('overloaded') ||
    message.includes('high demand') ||
    message.includes('rate limit') ||
    message.includes('resource exhausted') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('fetch failed') ||

    // Model unavailable / unsupported
    message.includes('model not found') ||
    message.includes('not found') ||
    message.includes('unsupported model') ||
    message.includes('model is not available') ||
    message.includes('does not support') ||
    message.includes('not supported')
  );
}

// =============================================================
// GEMINI GENERATION WITH AUTOMATIC MODEL FALLBACK
// =============================================================

async function generateWithFallback(
  ai,
  requestConfig,
  preferredModel = null
) {
  const errors = [];

  // If a preferred model exists, try it first.
  // Then try all other models.
  const orderedModels = preferredModel
    ? [
        preferredModel,
        ...GEMINI_MODELS.filter(
          (model) => model !== preferredModel
        ),
      ]
    : [...GEMINI_MODELS];

  for (const model of orderedModels) {
    const started = Date.now();

    try {
      console.log(
        `🤖 Trying Gemini model: ${model}`
      );

      const response =
        await ai.models.generateContent({
          ...requestConfig,
          model,
        });

      console.log(
        `✅ Gemini ${model} responded in ${
          Date.now() - started
        }ms`
      );

      return {
        response,
        model,
      };
    } catch (error) {
      const errorMessage =
        error?.message || String(error);

      console.error(
        `❌ Gemini ${model} failed after ${
          Date.now() - started
        }ms:`,
        errorMessage
      );

      errors.push({
        model,
        error: errorMessage,
      });

      // If this is something that can reasonably be solved
      // by another model, continue.
      if (isFallbackEligibleError(error)) {
        console.log(
          `🔄 Falling back from ${model}...`
        );

        continue;
      }

      // For genuine coding/request errors, don't blindly
      // retry every model.
      throw error;
    }
  }

  const finalError = new Error(
    'All configured Gemini models are currently unavailable.'
  );

  finalError.modelErrors = errors;

  throw finalError;
}

// =============================================================
// GEMINI CONNECTION TEST
// GET /api/ai/test
// =============================================================

router.get('/test', async (req, res) => {
  const started = Date.now();

  try {
    const apiKey =
      process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error:
          'GEMINI_API_KEY is missing on the backend',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const results = [];

    for (const model of GEMINI_MODELS) {
      try {
        const modelStarted = Date.now();

        console.log(
          `🧪 Testing Gemini model: ${model}`
        );

        const response =
          await ai.models.generateContent({
            model,
            contents:
              'Reply with exactly: GEMINI_OK',
          });

        results.push({
          model,
          ok: true,
          text: response.text,
          ms: Date.now() - modelStarted,
        });

        console.log(
          `✅ ${model} works`
        );
      } catch (error) {
        console.error(
          `❌ ${model} failed:`,
          error.message
        );

        results.push({
          model,
          ok: false,
          error: error.message,
        });
      }
    }

    const workingModels =
      results.filter(
        (result) => result.ok
      );

    if (workingModels.length === 0) {
      return res.status(503).json({
        ok: false,

        message:
          'No configured Gemini model is currently available.',

        models:
          GEMINI_MODELS,

        results,

        ms:
          Date.now() - started,
      });
    }

    return res.json({
      ok: true,

      workingModel:
        workingModels[0].model,

      workingModels:
        workingModels.map(
          (item) => item.model
        ),

      totalModels:
        GEMINI_MODELS.length,

      results,

      ms:
        Date.now() - started,
    });
  } catch (error) {
    console.error(
      'Gemini test error:',
      error
    );

    return res.status(500).json({
      ok: false,

      error:
        error.message,

      name:
        error.name,

      ms:
        Date.now() - started,
    });
  }
});

// =============================================================
// HELPERS FOR LEGACY SEARCH
// =============================================================

function normalizeText(value) {
  return String(
    value || ''
  )
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

function detectPreferences(query) {
  const text =
    normalizeText(query);

  return {
    chicken:
      /\bchicken\b/i.test(text),

    mutton:
      /\bmutton\b|\blamb\b/i.test(
        text
      ),

    fish:
      /\bfish\b|\bsalmon\b|\btuna\b/i.test(
        text
      ),

    seafood:
      /\bseafood\b|\bprawn\b|\bprawns\b|\bshrimp\b|\bcrab\b/i.test(
        text
      ),

    pizza:
      /\bpizza\b/i.test(text),

    burger:
      /\bburger\b|\bburgers\b/i.test(
        text
      ),

    pasta:
      /\bpasta\b/i.test(text),

    biryani:
      /\bbiryani\b/i.test(text),

    salad:
      /\bsalad\b/i.test(text),

    vegetarian:
      /\bvegetarian\b|\bveg\b|\bveggie\b/i.test(
        text
      ),

    nonVegetarian:
      /\bnon[- ]?veg\b|\bnon[- ]?vegetarian\b|\bnonveg\b/i.test(
        text
      ),

    spicy:
      /\bspicy\b|\bhot\b|\bfiery\b/i.test(
        text
      ),

    healthy:
      /\bhealthy\b|\bhealthier\b|\bnutritious\b/i.test(
        text
      ),

    lowCarb:
      /\blow[- ]?carb\b|\blow carbohydrates\b|\bless carbs\b/i.test(
        text
      ),

    highProtein:
      /\bhigh[- ]?protein\b|\bhigh protein\b|\bprotein rich\b|\bprotein-rich\b/i.test(
        text
      ),

    sweet:
      /\bsweet\b|\bdessert\b|\bdesserts\b/i.test(
        text
      ),

    cheap:
      /\bcheap\b|\baffordable\b|\bbudget\b|\binexpensive\b/i.test(
        text
      ),

    expensive:
      /\bexpensive\b|\bpremium\b|\bluxury\b/i.test(
        text
      ),

    light:
      /\blight\b|\blighter\b/i.test(
        text
      ),

    filling:
      /\bfilling\b|\bheavy\b/i.test(
        text
      ),
  };
}

function matchesStrongKeyword(
  item,
  preferences
) {
  const text =
    foodText(item);

  if (
    preferences.chicken &&
    !/\bchicken\b/i.test(text)
  ) {
    return false;
  }

  if (
    preferences.mutton &&
    !/\bmutton\b|\blamb\b/i.test(
      text
    )
  ) {
    return false;
  }

  if (
    preferences.fish &&
    !/\bfish\b|\bsalmon\b|\btuna\b/i.test(
      text
    )
  ) {
    return false;
  }

  if (
    preferences.seafood &&
    !/\bseafood\b|\bprawn\b|\bprawns\b|\bshrimp\b|\bcrab\b/i.test(
      text
    )
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

function calculateScore(
  item,
  query,
  preferences
) {
  const text =
    foodText(item);

  const queryWords =
    normalizeText(query)
      .split(/\s+/)
      .filter(
        (w) => w.length >= 3
      );

  let score = 0;

  for (const word of queryWords) {
    if (text.includes(word)) {
      score += 10;
    }
  }

  if (
    preferences.chicken &&
    /\bchicken\b/i.test(text)
  ) {
    score += 50;
  }

  if (
    preferences.mutton &&
    /\bmutton\b|\blamb\b/i.test(
      text
    )
  ) {
    score += 50;
  }

  if (
    preferences.fish &&
    /\bfish\b|\bsalmon\b|\btuna\b/i.test(
      text
    )
  ) {
    score += 50;
  }

  if (
    preferences.seafood &&
    /\bprawn\b|\bprawns\b|\bshrimp\b|\bcrab\b|\bseafood\b/i.test(
      text
    )
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

  if (
    preferences.highProtein &&
    /\bprotein\b|\begg\b|\bpaneer\b|\bchicken\b/i.test(
      text
    )
  ) {
    score += 30;
  }

  if (
    preferences.spicy &&
    /\bspicy\b|\bhot\b|\bchilli\b|\bmasala\b/i.test(
      text
    )
  ) {
    score += 25;
  }

  if (
    preferences.cheap &&
    typeof item.price ===
      'number' &&
    item.price <= 300
  ) {
    score += 20;
  }

  return score;
}

function createRestaurantMap(
  restaurants
) {
  const map = new Map();

  for (
    const restaurant of restaurants
  ) {
    map.set(
      String(restaurant._id),
      restaurant
    );
  }

  return map;
}

function createAvailableFoods(
  restaurants,
  menuItems
) {
  const restaurantMap =
    createRestaurantMap(
      restaurants
    );

  const availableFoods = [];

  for (
    const item of menuItems
  ) {
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
        restaurant.deliveryTime ||
        null,

      priceForTwo:
        restaurant.priceForTwo ||
        null,

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

function getCandidates(
  availableFoods,
  query
) {
  const preferences =
    detectPreferences(query);

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

  let candidates =
    hasStrongPreference
      ? availableFoods.filter(
          (item) =>
            matchesStrongKeyword(
              item,
              preferences
            )
        )
      : [...availableFoods];

  candidates = candidates
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

  return candidates
    .slice(0, 15)
    .map(
      ({ item }) => item
    );
}

// =============================================================
// DETERMINISTIC AGENT TOOLS
// =============================================================

async function toolSearchCatalog({
  query,
  maxPrice,
  isVeg,
  restaurantId,
}) {
  const filter = {};

  if (
    typeof isVeg === 'boolean'
  ) {
    filter.isVeg = isVeg;
  }

  if (
    maxPrice &&
    Number(maxPrice) > 0
  ) {
    filter.price = {
      $lte: Number(maxPrice),
    };
  }

  if (restaurantId) {
    filter.restaurant =
      restaurantId;
  }

  if (
    query &&
    String(query).trim()
  ) {
    const q =
      String(query)
        .trim()
        .toLowerCase();

    let searchTerms = [q];

    if (
      q.includes('protein')
    ) {
      searchTerms.push(
        'chicken',
        'egg',
        'paneer',
        'mutton',
        'fish',
        'tofu',
        'soya',
        'grilled'
      );
    }

    if (
      q.includes('carb')
    ) {
      searchTerms.push(
        'salad',
        'soup',
        'grilled',
        'roast',
        'tandoori',
        'chicken',
        'paneer'
      );
    }

    if (
      q.includes('healthy') ||
      q.includes('light')
    ) {
      searchTerms.push(
        'salad',
        'soup',
        'steamed',
        'grilled',
        'sprouts'
      );
    }

    const regexPattern =
      searchTerms.join('|');

    filter.$or = [
      {
        name: {
          $regex:
            regexPattern,
          $options: 'i',
        },
      },
      {
        description: {
          $regex:
            regexPattern,
          $options: 'i',
        },
      },
      {
        category: {
          $regex:
            regexPattern,
          $options: 'i',
        },
      },
    ];
  }

  const items =
    await MenuItem.find(
      filter
    )
      .populate(
        'restaurant',
        'name location rating deliveryTime image'
      )
      .limit(12)
      .lean();

  return items.map(
    (it) => ({
      itemId:
        it._id.toString(),

      name:
        it.name,

      price:
        it.price,

      isVeg:
        Boolean(it.isVeg),

      category:
        it.category ||
        'General',

      description:
        it.description ||
        '',

      restaurantId:
        it.restaurant?._id?.toString(),

      restaurantName:
        it.restaurant?.name ||
        'Partner Restaurant',

      image:
        it.image ||
        it.restaurant?.image ||
        null,
    })
  );
}

async function toolInspectAndOptimizeCart({
  cartItems,
}) {
  if (
    !cartItems ||
    !cartItems.length
  ) {
    return {
      currentTotal: 0,

      optimizedTotal: 0,

      savings: 0,

      modifications: [],

      explanation:
        'Cart is empty. Add items to discover bundle optimizations.',
    };
  }

  const itemIds =
    cartItems.map(
      (c) =>
        c.menuItem ||
        c._id
    );

  const dbItems =
    await MenuItem.find({
      _id: {
        $in: itemIds,
      },
    }).lean();

  let realTotal = 0;

  cartItems.forEach(
    (cartItem) => {
      const cartItemId =
        cartItem.menuItem ||
        cartItem._id;

      const matched =
        dbItems.find(
          (db) =>
            db._id.toString() ===
            cartItemId.toString()
        );

      const price = matched
        ? matched.price
        : cartItem.price;

      realTotal +=
        Number(price) *
        Number(
          cartItem.quantity || 1
        );
    }
  );

  let savings = 0;

  const modifications = [];

  if (
    realTotal >= 600
  ) {
    savings =
      Math.round(
        realTotal * 0.1
      );

    modifications.push({
      type:
        'BUNDLE_DISCOUNT',

      description:
        'Applied 10% Foodie Smart Combo Saver on orders above ₹600',

      discountAmount:
        savings,
    });
  }

  return {
    currentTotal:
      realTotal,

    optimizedTotal:
      realTotal - savings,

    savings,

    modifications,

    explanation:
      savings > 0
        ? `Applied dynamic meal bundle optimization to save you ₹${savings}.`
        : 'Your cart is already at optimal value with no redundant items detected.',
  };
}

async function toolGenerateGroupMealPlan({
  totalPeople,
  vegCount,
  maxBudget,
  restaurantId,
}) {
  const people =
    Number(totalPeople) || 2;

  const veg =
    Number(vegCount) || 0;

  const nonVeg =
    Math.max(
      0,
      people - veg
    );

  const budget =
    Number(maxBudget) || 2000;

  const filter = {};

  if (restaurantId) {
    filter.restaurant =
      restaurantId;
  }

  const catalog =
    await MenuItem.find(
      filter
    )
      .populate(
        'restaurant',
        'name deliveryTime image'
      )
      .lean();

  if (
    !catalog.length
  ) {
    return {
      error:
        'No menu items available matching group criteria.',
    };
  }

  const vegItems =
    catalog
      .filter(
        (i) => i.isVeg
      )
      .sort(
        (a, b) =>
          a.price - b.price
      );

  const nonVegItems =
    catalog
      .filter(
        (i) => !i.isVeg
      )
      .sort(
        (a, b) =>
          a.price - b.price
      );

  const proposedItems = [];

  let allocatedTotal = 0;

  if (veg > 0) {
    const targetVegSpend =
      (budget / people) *
      veg;

    let vegSpend = 0;

    for (
      const item of vegItems
    ) {
      if (
        vegSpend +
          item.price <=
          targetVegSpend &&
        proposedItems.length <
          veg * 2
      ) {
        proposedItems.push({
          itemId:
            item._id.toString(),

          name:
            item.name,

          price:
            item.price,

          quantity:
            1,

          isVeg:
            true,

          restaurantId:
            item.restaurant?._id?.toString(),

          restaurantName:
            item.restaurant?.name,

          image:
            item.image ||
            item.restaurant?.image ||
            null,
        });

        vegSpend +=
          item.price;

        allocatedTotal +=
          item.price;
      }
    }
  }

  if (nonVeg > 0) {
    const targetNonVegSpend =
      budget -
      allocatedTotal;

    let nonVegSpend = 0;

    const pool =
      nonVegItems.length
        ? nonVegItems
        : vegItems;

    for (
      const item of pool
    ) {
      if (
        nonVegSpend +
          item.price <=
          targetNonVegSpend &&
        proposedItems.length <
          people * 2
      ) {
        proposedItems.push({
          itemId:
            item._id.toString(),

          name:
            item.name,

          price:
            item.price,

          quantity:
            1,

          isVeg:
            item.isVeg,

          restaurantId:
            item.restaurant?._id?.toString(),

          restaurantName:
            item.restaurant?.name,

          image:
            item.image ||
            item.restaurant?.image ||
            null,
        });

        nonVegSpend +=
          item.price;

        allocatedTotal +=
          item.price;
      }
    }
  }

  return {
    totalPeople:
      people,

    vegPortions:
      veg,

    nonVegPortions:
      nonVeg,

    proposedItems,

    calculatedTotal:
      allocatedTotal,

    budgetRemaining:
      budget -
      allocatedTotal,

    explanation:
      `Constructed balanced meal for ${people} people (${veg} veg, ${nonVeg} non-veg) totaling ₹${allocatedTotal} within your ₹${budget} budget.`,
  };
}

// =============================================================
// GEMINI FUNCTION DEFINITIONS
// =============================================================

const agentTools = [
  {
    functionDeclarations: [
      {
        name:
          'searchCatalog',

        description:
          'Search real restaurant menu items matching user queries, dishes, dietary choices, protein/carb preferences, budgets, or names. MUST be called for any food recommendation request.',

        parameters: {
          type:
            'object',

          properties: {
            query: {
              type:
                'string',

              description:
                'Search keywords like spicy, chicken, high protein, low carb, pizza, burger, biryani, healthy',
            },

            maxPrice: {
              type:
                'number',

              description:
                'Maximum price threshold per dish in INR',
            },

            isVeg: {
              type:
                'boolean',

              description:
                'True for purely vegetarian items, false for non-vegetarian',
            },

            restaurantId: {
              type:
                'string',

              description:
                'Optional specific restaurant ID',
            },
          },
        },
      },

      {
        name:
          'inspectAndOptimizeCart',

        description:
          'Analyze current cart items for bundle discounts, redundant items, and cost optimization.',

        parameters: {
          type:
            'object',

          properties: {
            cartItems: {
              type:
                'array',

              items: {
                type:
                  'object',

                properties: {
                  menuItem: {
                    type:
                      'string',
                  },

                  name: {
                    type:
                      'string',
                  },

                  price: {
                    type:
                      'number',
                  },

                  quantity: {
                    type:
                      'number',
                  },
                },
              },

              description:
                'List of items currently in cart',
            },
          },

          required: [
            'cartItems',
          ],
        },
      },

      {
        name:
          'generateGroupMealPlan',

        description:
          'Construct a group order combination adhering to group size, vegetarian dietary constraints, and total budget.',

        parameters: {
          type:
            'object',

          properties: {
            totalPeople: {
              type:
                'number',

              description:
                'Total number of members ordering',
            },

            vegCount: {
              type:
                'number',

              description:
                'Number of strict vegetarians in group',
            },

            maxBudget: {
              type:
                'number',

              description:
                'Hard total budget in INR',
            },

            restaurantId: {
              type:
                'string',

              description:
                'Optional target restaurant ID',
            },
          },

          required: [
            'totalPeople',
            'maxBudget',
          ],
        },
      },
    ],
  },
];

// =============================================================
// AI GROUP ORDER PLANNER
// POST /api/ai/group-planner
// =============================================================

router.post(
  '/group-planner',
  async (req, res) => {
    const auditLogs = [];

    const addAudit = (
      step,
      detail
    ) => {
      const timestamp =
        new Date().toLocaleTimeString(
          'en-IN',
          {
            hour12: false,
          }
        );

      auditLogs.push({
        time:
          timestamp,

        step,

        detail,
      });
    };

    try {
      const {
        groupCode,
        preferences = [],
        totalBudget = 1500,
      } = req.body;

      if (!groupCode) {
        return res.status(400).json({
          message:
            'Group code is required.',
        });
      }

      addAudit(
        'Request Ingestion',
        `Planning group meal for Room #${groupCode} (${preferences.length} members)`
      );

      const groupOrder =
        await Order.findOne({
          groupCode:
            groupCode.toUpperCase(),

          isGroupOrder:
            true,
        })
          .populate(
            'restaurant'
          )
          .lean();

      if (
        !groupOrder ||
        !groupOrder.restaurant
      ) {
        return res.status(404).json({
          message:
            'Active group order or restaurant room not found.',
        });
      }

      const restaurantId =
        groupOrder.restaurant
          ._id;

      addAudit(
        'Context Binding',
        `Bound restaurant: ${groupOrder.restaurant.name}`
      );

      const realMenu =
        await MenuItem.find({
          restaurant:
            restaurantId,
        }).lean();

      if (
        !realMenu ||
        realMenu.length === 0
      ) {
        return res.status(400).json({
          message:
            'No menu items found for this restaurant.',
        });
      }

      addAudit(
        'Catalog Hydration',
        `Loaded ${realMenu.length} real catalog items from MongoDB`
      );

      let totalSpent = 0;

      const memberRecommendations =
        [];

      preferences.forEach(
        (member, idx) => {
          const isVegOnly =
            member.foodPreference ===
            'Vegetarian';

          const isSpicy =
            member.spicePreference ===
            'Spicy';

          const maxMemBudget =
            Number(
              member.personalBudget
            ) ||
            Math.floor(
              totalBudget /
                Math.max(
                  1,
                  preferences.length
                )
            );

          let candidatePool =
            realMenu.filter(
              (item) => {
                if (
                  isVegOnly &&
                  !item.isVeg
                ) {
                  return false;
                }

                if (
                  item.price >
                  maxMemBudget
                ) {
                  return false;
                }

                return true;
              }
            );

          if (
            candidatePool.length ===
            0
          ) {
            candidatePool =
              realMenu.filter(
                (item) =>
                  isVegOnly
                    ? item.isVeg
                    : true
              );
          }

          candidatePool.sort(
            (a, b) => {
              let scoreA = 0;

              let scoreB = 0;

              if (
                member.cravings &&
                a.name
                  .toLowerCase()
                  .includes(
                    member.cravings.toLowerCase()
                  )
              ) {
                scoreA += 50;
              }

              if (
                member.cravings &&
                b.name
                  .toLowerCase()
                  .includes(
                    member.cravings.toLowerCase()
                  )
              ) {
                scoreB += 50;
              }

              if (
                isSpicy &&
                (
                  a.name
                    .toLowerCase()
                    .includes(
                      'spicy'
                    ) ||
                  a.description
                    ?.toLowerCase()
                    .includes(
                      'spicy'
                    )
                )
              ) {
                scoreA += 20;
              }

              if (
                isSpicy &&
                (
                  b.name
                    .toLowerCase()
                    .includes(
                      'spicy'
                    ) ||
                  b.description
                    ?.toLowerCase()
                    .includes(
                      'spicy'
                    )
                )
              ) {
                scoreB += 20;
              }

              return (
                scoreB -
                scoreA
              );
            }
          );

          const chosen =
            candidatePool[0] ||
            realMenu[0];

          memberRecommendations.push(
            {
              memberName:
                member.name ||
                `Member ${
                  idx + 1
                }`,

              itemId:
                chosen._id.toString(),

              name:
                chosen.name,

              price:
                chosen.price,

              isVeg:
                chosen.isVeg,

              image:
                chosen.image ||
                groupOrder
                  .restaurant
                  .image ||
                null,

              reason:
                `Matches ${
                  member.foodPreference ||
                  'all'
                } dietary choice & ₹${
                  chosen.price
                } personal budget.`,
            }
          );

          totalSpent +=
            chosen.price;
        }
      );

      const budgetRemaining =
        totalBudget -
        totalSpent;

      const sharedSuggestions =
        [];

      if (
        budgetRemaining >=
        100
      ) {
        const addOns =
          realMenu.filter(
            (i) =>
              i.price <=
                budgetRemaining &&
              i.price >= 40
          );

        if (
          addOns.length > 0
        ) {
          sharedSuggestions.push(
            {
              itemId:
                addOns[0]._id.toString(),

              name:
                addOns[0].name,

              price:
                addOns[0].price,

              isVeg:
                addOns[0].isVeg,

              image:
                addOns[0].image ||
                groupOrder
                  .restaurant
                  .image ||
                null,

              reason:
                `Recommended shared item fitting remaining ₹${budgetRemaining} budget!`,
            }
          );
        }
      }

      addAudit(
        'Optimization Completed',
        `Created full group order totaling ₹${totalSpent} (Budget ₹${totalBudget})`
      );

      const explanationText =
        `Why this works:
✓ Satisfies dietary restrictions for all ${preferences.length} members.
✓ Uses REAL menu dishes from ${groupOrder.restaurant.name}.
✓ Total cost is ₹${totalSpent}, keeping you ₹${Math.max(
          0,
          budgetRemaining
        )} under your ₹${totalBudget} budget.`;

      return res.json({
        success:
          true,

        restaurantName:
          groupOrder
            .restaurant
            .name,

        totalBudget,

        totalSpent,

        budgetRemaining:
          Math.max(
            0,
            budgetRemaining
          ),

        memberRecommendations,

        sharedSuggestions,

        explanation:
          explanationText,

        auditTrail:
          auditLogs,
      });
    } catch (error) {
      console.error(
        'Group Planner Error:',
        error
      );

      return res.status(500).json({
        message:
          'Failed to generate group meal plan',

        error:
          error.message,
      });
    }
  }
);

// =============================================================
// AGENTIC COMMERCE
// POST /api/ai/agent
// =============================================================

router.post(
  '/agent',
  async (req, res) => {
    const auditLogs = [];

    const addAudit = (
      step,
      detail
    ) => {
      const timestamp =
        new Date().toLocaleTimeString(
          'en-IN',
          {
            hour12: false,
          }
        );

      auditLogs.push({
        time:
          timestamp,

        step,

        detail,
      });
    };

    try {
      const {
        prompt,
        cart = [],
        activeGroupCode = null,
      } = req.body;

      if (
        !prompt ||
        typeof prompt !==
          'string' ||
        !prompt.trim()
      ) {
        return res.status(400).json({
          message:
            'A natural language query is required.',
        });
      }

      addAudit(
        'Request Ingestion',
        `User input: "${prompt.trim()}"`
      );

      const ai =
        getGeminiAI();

      if (!ai) {
        addAudit(
          'Error',
          'GEMINI_API_KEY missing on backend'
        );

        return res.status(500).json({
          message:
            'Gemini AI is not configured on the backend.',

          auditTrail:
            auditLogs,
        });
      }

      // ---------------------------------------------------------
      // LOAD ACTIVE GROUP CONTEXT
      // ---------------------------------------------------------

      let groupOrderContext =
        null;

      if (
        activeGroupCode
      ) {
        groupOrderContext =
          await Order.findOne({
            groupCode:
              activeGroupCode.toUpperCase(),

            isGroupOrder:
              true,
          })
            .populate(
              'restaurant',
              'name'
            )
            .lean();

        if (
          groupOrderContext
        ) {
          addAudit(
            'Context Binding',
            `Bound active group room #${activeGroupCode}`
          );
        }
      }

      // ---------------------------------------------------------
      // SYSTEM INSTRUCTION
      // ---------------------------------------------------------

      const systemInstruction = `
You are the Foodie AI Commerce Agent for Razorpay Buildathon Track 01.

CRITICAL RULES:

1. IF THE USER ASKS FOR FOOD, MENU ITEMS, RECOMMENDATIONS, DIETARY OPTIONS ("high protein", "low carb", "healthy"), BUDGET MEALS, OR CUISINES, YOU MUST ALWAYS CALL searchCatalog FIRST. DO NOT ANSWER DIRECTLY.

2. NEVER invent dishes or prices. Only use real items returned by tool calls.

3. If the user wants to order for a group, call generateGroupMealPlan.

4. If the user wants to optimize their cart or save money, call inspectAndOptimizeCart.

5. Provide concise, friendly explanations without using raw Markdown symbols like **, *, or ###.

6. NEVER claim that an item exists unless it was returned by a tool.

7. If the catalog returns no suitable items, clearly say that no matching item was found.

8. Do not perform financial transactions automatically. Financial operations require human authorization.

Current Cart Context:
${JSON.stringify(cart)}

Group Room Context:
${
  groupOrderContext
    ? JSON.stringify(
        groupOrderContext
      )
    : 'None'
}
`;

      addAudit(
        'Intent Classification',
        'Evaluating constraints (budget, veg/non-veg, group size, cart context)'
      );

      // ---------------------------------------------------------
      // FIRST GEMINI CALL WITH AUTOMATIC FALLBACK
      // ---------------------------------------------------------

      const {
        response,
        model: usedModel,
      } =
        await generateWithFallback(
          ai,
          {
            contents:
              prompt,

            config: {
              systemInstruction,

              tools:
                agentTools,
            },
          }
        );

      addAudit(
        'Gemini Model',
        `Used ${usedModel}`
      );

      let finalAssistantText =
        '';

      let toolCallResult =
        null;

      let proposedActions =
        null;

      // ---------------------------------------------------------
      // FUNCTION CALL
      // ---------------------------------------------------------

      if (
        response.functionCalls &&
        response.functionCalls.length >
          0
      ) {
        const call =
          response
            .functionCalls[0];

        addAudit(
          'Tool Invoked',
          `Executing tool: ${call.name}`
        );

        // -------------------------------------------------------
        // SEARCH CATALOG
        // -------------------------------------------------------

        if (
          call.name ===
          'searchCatalog'
        ) {
          toolCallResult =
            await toolSearchCatalog(
              call.args || {}
            );

          addAudit(
            'Catalog Query',
            `Found ${toolCallResult.length} matching dishes in MongoDB`
          );
        }

        // -------------------------------------------------------
        // OPTIMIZE CART
        // -------------------------------------------------------

        else if (
          call.name ===
          'inspectAndOptimizeCart'
        ) {
          toolCallResult =
            await toolInspectAndOptimizeCart(
              {
                cartItems:
                  call.args
                    ?.cartItems ||
                  cart,
              }
            );

          addAudit(
            'Cart Optimization',
            `Evaluated savings: ₹${toolCallResult.savings}`
          );
        }

        // -------------------------------------------------------
        // GROUP MEAL PLAN
        // -------------------------------------------------------

        else if (
          call.name ===
          'generateGroupMealPlan'
        ) {
          toolCallResult =
            await toolGenerateGroupMealPlan(
              call.args || {}
            );

          addAudit(
            'Group Plan Engine',
            `Composed meal for ${
              call.args
                ?.totalPeople ||
              0
            } people totaling ₹${
              toolCallResult
                .calculatedTotal ||
              0
            }`
          );
        }

        // -------------------------------------------------------
        // UNKNOWN TOOL
        // -------------------------------------------------------

        else {
          throw new Error(
            `Unknown Gemini tool requested: ${call.name}`
          );
        }

        // -------------------------------------------------------
        // GEMINI FUNCTION-CALL FOLLOW-UP
        // -------------------------------------------------------

        const modelContent =
          response
            .candidates?.[0]
            ?.content;

        if (!modelContent) {
          throw new Error(
            'Gemini returned a function call but no model content was available for the follow-up.'
          );
        }

        // Try the SAME model first.
        // This is important because the function call was
        // generated by that model.
        const {
          response:
            followUp,
          model:
            followUpModel,
        } =
          await generateWithFallback(
            ai,
            {
              contents: [
                {
                  role:
                    'user',

                  parts: [
                    {
                      text:
                        prompt,
                    },
                  ],
                },

                // Preserve Gemini's original model response.
                modelContent,

                {
                  role:
                    'user',

                  parts: [
                    {
                      functionResponse:
                        {
                          id:
                            call.id,

                          name:
                            call.name,

                          response:
                            {
                              result:
                                toolCallResult,
                            },
                        },
                    },
                  ],
                },
              ],

              config: {
                systemInstruction,

                tools:
                  agentTools,
              },
            },

            usedModel
          );

        addAudit(
          'Gemini Follow-up',
          `Used ${followUpModel}`
        );

        finalAssistantText =
          followUp.text?.trim() ||
          'I found the options matching your preferences from our menu.';

        // -------------------------------------------------------
        // PROPOSED ACTION: GROUP ORDER
        // -------------------------------------------------------

        if (
          call.name ===
            'generateGroupMealPlan' &&
          toolCallResult &&
          toolCallResult.proposedItems
        ) {
          proposedActions = {
            type:
              'POPULATE_GROUP_ORDER',

            items:
              toolCallResult.proposedItems,

            totalAmount:
              toolCallResult.calculatedTotal,

            requiresApproval:
              true,
          };
        }

        // -------------------------------------------------------
        // PROPOSED ACTION: RECOMMENDATIONS
        // -------------------------------------------------------

        else if (
          call.name ===
            'searchCatalog' &&
          Array.isArray(
            toolCallResult
          ) &&
          toolCallResult.length >
            0
        ) {
          proposedActions = {
            type:
              'RECOMMENDATION_LIST',

            items:
              toolCallResult,

            requiresApproval:
              false,
          };
        }

        // -------------------------------------------------------
        // PROPOSED ACTION: CART OPTIMIZATION
        // -------------------------------------------------------

        else if (
          call.name ===
            'inspectAndOptimizeCart' &&
          toolCallResult &&
          toolCallResult.savings >
            0
        ) {
          proposedActions = {
            type:
              'APPLY_CART_OPTIMIZATION',

            savings:
              toolCallResult.savings,

            newTotal:
              toolCallResult.optimizedTotal,

            requiresApproval:
              true,
          };
        }
      }

      // ---------------------------------------------------------
      // NO TOOL CALL FALLBACK
      // ---------------------------------------------------------

      else {
        addAudit(
          'Catalog Fallback',
          'Gemini did not call a tool, so deterministic catalog search was executed.'
        );

        toolCallResult =
          await toolSearchCatalog({
            query:
              prompt,
          });

        addAudit(
          'Catalog Fallback',
          `Retrieved ${toolCallResult.length} dishes`
        );

        finalAssistantText =
          toolCallResult.length >
          0
            ? `Here are the matching options found from our catalog for "${prompt}".`
            : `I could not find dishes matching "${prompt}" in our catalog. Try searching for other items like chicken, pizza, or paneer!`;

        if (
          toolCallResult.length >
          0
        ) {
          proposedActions = {
            type:
              'RECOMMENDATION_LIST',

            items:
              toolCallResult,

            requiresApproval:
              false,
          };
        }
      }

      // ---------------------------------------------------------
      // COMPLETE
      // ---------------------------------------------------------

      addAudit(
        'Decision Completed',
        'Awaiting human authorization for any financial operations'
      );

      return res.json({
        reply:
          finalAssistantText,

        data:
          toolCallResult,

        proposedActions,

        auditTrail:
          auditLogs,
      });
    } catch (error) {
      console.error(
        'Agent processing error:',
        error
      );

      addAudit(
        'Error Encountered',
        error.message ||
          'Processing failed'
      );

      return res.status(500).json({
        message:
          'Agent could not complete request.',

        error:
          error.message,

        modelErrors:
          error.modelErrors ||
          undefined,

        auditTrail:
          auditLogs,
      });
    }
  }
);

// =============================================================
// LEGACY ROUTE: BACKWARD COMPATIBLE RECOMMENDATION
// POST /api/ai/recommend
// =============================================================

router.post(
  '/recommend',
  async (req, res) => {
    try {
      const {
        query,
      } = req.body;

      if (
        typeof query !==
          'string' ||
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

      const ai =
        getGeminiAI();

      if (!ai) {
        return res.status(500).json({
          message:
            'Gemini AI is not configured on the backend. Please check GEMINI_API_KEY in Render Environment Variables.',

          recommendations: [],
        });
      }

      const restaurants =
        await Restaurant.find(
          {}
        ).lean();

      const menuItems =
        await MenuItem.find(
          {}
        ).lean();

      if (
        menuItems.length ===
        0
      ) {
        return res.json({
          message:
            'There are no menu items available yet. Please add some dishes from the admin panel. 🍽️',

          recommendations: [],
        });
      }

      const availableFoods =
        createAvailableFoods(
          restaurants,
          menuItems
        );

      if (
        availableFoods.length ===
        0
      ) {
        return res.json({
          message:
            'There are no valid menu items connected to restaurants yet. 🍽️',

          recommendations: [],
        });
      }

      const candidates =
        getCandidates(
          availableFoods,
          cleanQuery
        );

      if (
        candidates.length ===
        0
      ) {
        return res.json({
          message:
            `I couldn't find a suitable match for "${cleanQuery}". Try another food or preference. 🤔`,

          recommendations: [],
        });
      }

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
"${cleanQuery}"

CANDIDATE MENU ITEMS:
${JSON.stringify(
  candidateDatabase
)}

Rules:

1. ONLY choose items from the candidate list.

2. NEVER invent a restaurant, item, ID, or price.

3. Recommend at most 5 items.

4. If the request says vegetarian, choose only isVeg=true.

Return JSON only matching the schema.
`;

      // ---------------------------------------------------------
      // GEMINI RECOMMENDATION WITH FALLBACK
      // ---------------------------------------------------------

      const {
        response,
        model: usedModel,
      } =
        await generateWithFallback(
          ai,
          {
            contents:
              prompt,

            config: {
              responseMimeType:
                'application/json',

              responseSchema:
                {
                  type:
                    'object',

                  properties: {
                    recommendations:
                      {
                        type:
                          'array',

                        items:
                          {
                            type:
                              'object',

                            properties:
                              {
                                menuItemId:
                                  {
                                    type:
                                      'string',
                                  },

                                restaurantId:
                                  {
                                    type:
                                      'string',
                                  },

                                reason:
                                  {
                                    type:
                                      'string',
                                  },
                              },

                            required:
                              [
                                'menuItemId',
                                'restaurantId',
                                'reason',
                              ],
                          },
                      },

                    message:
                      {
                        type:
                          'string',
                      },
                  },

                  required:
                    [
                      'recommendations',
                      'message',
                    ],
                },

              maxOutputTokens:
                2000,
            },
          }
        );

      console.log(
        `🍽️ Recommendation generated using ${usedModel}`
      );

      const responseText =
        response.text?.trim();

      if (!responseText) {
        throw new Error(
          'Gemini returned an empty response.'
        );
      }

      let aiResult;

      try {
        aiResult =
          JSON.parse(
            responseText
          );
      } catch (
        parseErr
      ) {
        console.error(
          'Failed to parse Gemini JSON:',
          responseText
        );

        return res.json({
          message:
            'Could not format recommendations properly.',

          recommendations: [],
        });
      }

      const menuMap =
        new Map();

      for (
        const item of menuItems
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

      for (
        const rec of
          aiResult
            .recommendations ||
          []
      ) {
        if (
          !rec?.menuItemId ||
          !rec?.restaurantId
        ) {
          continue;
        }

        const menuItem =
          menuMap.get(
            String(
              rec.menuItemId
            )
          );

        const restaurant =
          restaurantMap.get(
            String(
              rec.restaurantId
            )
          );

        if (
          !menuItem ||
          !restaurant
        ) {
          continue;
        }

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

        validatedRecommendations.push(
          {
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
              rec.reason ||
              'This dish matches your request.',
          }
        );

        if (
          validatedRecommendations.length >=
          5
        ) {
          break;
        }
      }

      return res.json({
        message:
          aiResult.message ||
          `I found ${validatedRecommendations.length} great options for you! 🍽️`,

        recommendations:
          validatedRecommendations,

        model:
          usedModel,
      });
    } catch (error) {
      console.error(
        'AI recommendation error:',
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          'Could not generate recommendations.',

        recommendations: [],

        modelErrors:
          error.modelErrors ||
          undefined,
      });
    }
  }
);

// =============================================================
// EXPORT
// =============================================================

export default router;
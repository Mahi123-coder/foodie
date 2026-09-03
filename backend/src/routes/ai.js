import 'dotenv/config';
import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

import Restaurant from '../models/Restaurant.js';
import MenuItem from '../models/MenuItem.js';
import Order from '../models/Order.js';

const router = Router();

// =============================================================
// CONFIG
// =============================================================

const GEMINI_MODEL = 'gemini-3.6-flash';

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
// HELPERS FOR LEGACY SEARCH
// =============================================================

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function foodText(item) {
  return [item.name, item.description].filter(Boolean).join(' ').toLowerCase();
}

function isVegItem(item) {
  return item.isVeg === true;
}

function isNonVegItem(item) {
  return item.isVeg === false;
}

function detectPreferences(query) {
  const text = normalizeText(query);
  return {
    chicken: /\bchicken\b/i.test(text),
    mutton: /\bmutton\b|\blamb\b/i.test(text),
    fish: /\bfish\b|\bsalmon\b|\btuna\b/i.test(text),
    seafood: /\bseafood\b|\bprawn\b|\bprawns\b|\bshrimp\b|\bcrab\b/i.test(text),
    pizza: /\bpizza\b/i.test(text),
    burger: /\bburger\b|\bburgers\b/i.test(text),
    pasta: /\bpasta\b/i.test(text),
    biryani: /\bbiryani\b/i.test(text),
    salad: /\bsalad\b/i.test(text),
    vegetarian: /\bvegetarian\b|\bveg\b|\bveggie\b/i.test(text),
    nonVegetarian: /\bnon[- ]?veg\b|\bnon[- ]?vegetarian\b|\bnonveg\b/i.test(text),
    spicy: /\bspicy\b|\bhot\b|\bfiery\b/i.test(text),
    healthy: /\bhealthy\b|\bhealthier\b|\bnutritious\b/i.test(text),
    lowCarb: /\blow[- ]?carb\b|\blow carbohydrates\b|\bless carbs\b/i.test(text),
    highProtein: /\bhigh[- ]?protein\b|\bhigh protein\b|\bprotein rich\b|\bprotein-rich\b/i.test(text),
    sweet: /\bsweet\b|\bdessert\b|\bdesserts\b/i.test(text),
    cheap: /\bcheap\b|\baffordable\b|\bbudget\b|\binexpensive\b/i.test(text),
    expensive: /\bexpensive\b|\bpremium\b|\bluxury\b/i.test(text),
    light: /\blight\b|\blighter\b/i.test(text),
    filling: /\bfilling\b|\bheavy\b/i.test(text),
  };
}

function matchesStrongKeyword(item, preferences) {
  const text = foodText(item);
  if (preferences.chicken && !/\bchicken\b/i.test(text)) return false;
  if (preferences.mutton && !/\bmutton\b|\blamb\b/i.test(text)) return false;
  if (preferences.fish && !/\bfish\b|\bsalmon\b|\btuna\b/i.test(text)) return false;
  if (preferences.seafood && !/\bseafood\b|\bprawn\b|\bprawns\b|\bshrimp\b|\bcrab\b/i.test(text)) return false;
  if (preferences.pizza && !/\bpizza\b/i.test(text)) return false;
  if (preferences.burger && !/\bburger\b/i.test(text)) return false;
  if (preferences.pasta && !/\bpasta\b/i.test(text)) return false;
  if (preferences.biryani && !/\bbiryani\b/i.test(text)) return false;
  if (preferences.salad && !/\bsalad\b/i.test(text)) return false;
  if (preferences.vegetarian && !isVegItem(item)) return false;
  if (preferences.nonVegetarian && !isNonVegItem(item)) return false;
  return true;
}

function calculateScore(item, query, preferences) {
  const text = foodText(item);
  const queryWords = normalizeText(query).split(/\s+/).filter((w) => w.length >= 3);
  let score = 0;

  for (const word of queryWords) {
    if (text.includes(word)) score += 10;
  }
  if (preferences.chicken && /\bchicken\b/i.test(text)) score += 50;
  if (preferences.mutton && /\bmutton\b|\blamb\b/i.test(text)) score += 50;
  if (preferences.fish && /\bfish\b|\bsalmon\b|\btuna\b/i.test(text)) score += 50;
  if (preferences.seafood && /\bprawn\b|\bprawns\b|\bshrimp\b|\bcrab\b|\bseafood\b/i.test(text)) score += 50;
  if (preferences.pizza && /\bpizza\b/i.test(text)) score += 50;
  if (preferences.burger && /\bburger\b/i.test(text)) score += 50;
  if (preferences.pasta && /\bpasta\b/i.test(text)) score += 50;
  if (preferences.biryani && /\bbiryani\b/i.test(text)) score += 50;
  if (preferences.salad && /\bsalad\b/i.test(text)) score += 50;
  if (preferences.highProtein && /\bprotein\b|\begg\b|\bpaneer\b|\bchicken\b/i.test(text)) score += 30;
  if (preferences.spicy && /\bspicy\b|\bhot\b|\bchilli\b|\bmasala\b/i.test(text)) score += 25;
  if (preferences.cheap && typeof item.price === 'number' && item.price <= 300) score += 20;

  return score;
}

function createRestaurantMap(restaurants) {
  const map = new Map();
  for (const restaurant of restaurants) {
    map.set(String(restaurant._id), restaurant);
  }
  return map;
}

function createAvailableFoods(restaurants, menuItems) {
  const restaurantMap = createRestaurantMap(restaurants);
  const availableFoods = [];

  for (const item of menuItems) {
    const restaurant = restaurantMap.get(String(item.restaurant));
    if (!restaurant) continue;

    availableFoods.push({
      restaurantId: String(restaurant._id),
      restaurantName: restaurant.name,
      cuisine: restaurant.cuisine || [],
      restaurantRating: restaurant.rating || 0,
      restaurantLocation: restaurant.location || '',
      deliveryTime: restaurant.deliveryTime || null,
      priceForTwo: restaurant.priceForTwo || null,
      menuItemId: String(item._id),
      menuItemName: item.name,
      description: item.description || '',
      price: item.price,
      isVeg: item.isVeg,
      image: item.image || null,
    });
  }
  return availableFoods;
}

function getCandidates(availableFoods, query) {
  const preferences = detectPreferences(query);
  const hasStrongPreference =
    preferences.chicken || preferences.mutton || preferences.fish ||
    preferences.seafood || preferences.pizza || preferences.burger ||
    preferences.pasta || preferences.biryani || preferences.salad ||
    preferences.vegetarian || preferences.nonVegetarian;

  let candidates = hasStrongPreference
    ? availableFoods.filter((item) => matchesStrongKeyword(item, preferences))
    : [...availableFoods];

  candidates = candidates
    .map((item) => ({ item, score: calculateScore(item, query, preferences) }))
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    candidates = availableFoods
      .map((item) => ({ item, score: calculateScore(item, query, preferences) }))
      .sort((a, b) => b.score - a.score);
  }

  return candidates.slice(0, 15).map(({ item }) => item);
}

// =============================================================
// DETERMINISTIC AGENT TOOLS (OPERATES ON MONGODB DIRECTLY)
// =============================================================

async function toolSearchCatalog({ query, maxPrice, isVeg, restaurantId }) {
  const filter = {};

  if (typeof isVeg === 'boolean') {
    filter.isVeg = isVeg;
  }

  if (maxPrice && Number(maxPrice) > 0) {
    filter.price = { $lte: Number(maxPrice) };
  }

  if (restaurantId) {
    filter.restaurant = restaurantId;
  }

  if (query && query.trim()) {
    filter.$or = [
      { name: { $regex: query.trim(), $options: 'i' } },
      { description: { $regex: query.trim(), $options: 'i' } },
      { category: { $regex: query.trim(), $options: 'i' } }
    ];
  }

  const items = await MenuItem.find(filter)
    .populate('restaurant', 'name location rating deliveryTime')
    .limit(12)
    .lean();

  return items.map((it) => ({
    itemId: it._id.toString(),
    name: it.name,
    price: it.price,
    isVeg: Boolean(it.isVeg),
    category: it.category || 'General',
    description: it.description || '',
    restaurantId: it.restaurant?._id?.toString(),
    restaurantName: it.restaurant?.name || 'Partner Restaurant'
  }));
}

async function toolInspectAndOptimizeCart({ cartItems }) {
  if (!cartItems || !cartItems.length) {
    return {
      currentTotal: 0,
      optimizedTotal: 0,
      savings: 0,
      modifications: [],
      explanation: 'Cart is empty. Add items to discover bundle optimizations.'
    };
  }

  const itemIds = cartItems.map((c) => c.menuItem || c._id);
  const dbItems = await MenuItem.find({ _id: { $in: itemIds } }).lean();

  let realTotal = 0;
  cartItems.forEach((cartItem) => {
    const matched = dbItems.find(
      (db) => db._id.toString() === (cartItem.menuItem || cartItem._id).toString()
    );
    const price = matched ? matched.price : cartItem.price;
    realTotal += Number(price) * Number(cartItem.quantity || 1);
  });

  let savings = 0;
  const modifications = [];

  // Dynamic threshold: 10% bundle savings if order >= ₹600
  if (realTotal >= 600) {
    savings = Math.round(realTotal * 0.1);
    modifications.push({
      type: 'BUNDLE_DISCOUNT',
      description: 'Applied 10% Foodie Smart Combo Saver on orders above ₹600',
      discountAmount: savings
    });
  }

  return {
    currentTotal: realTotal,
    optimizedTotal: realTotal - savings,
    savings,
    modifications,
    explanation:
      savings > 0
        ? `Applied dynamic meal bundle optimization to save you ₹${savings}.`
        : 'Your cart is already at optimal value with no redundant items detected.'
  };
}

async function toolGenerateGroupMealPlan({ totalPeople, vegCount, maxBudget, restaurantId }) {
  const people = Number(totalPeople) || 2;
  const veg = Number(vegCount) || 0;
  const nonVeg = Math.max(0, people - veg);
  const budget = Number(maxBudget) || 2000;

  const filter = {};
  if (restaurantId) filter.restaurant = restaurantId;

  const catalog = await MenuItem.find(filter)
    .populate('restaurant', 'name deliveryTime')
    .lean();

  if (!catalog.length) {
    return { error: 'No menu items available matching group criteria.' };
  }

  const vegItems = catalog.filter((i) => i.isVeg).sort((a, b) => a.price - b.price);
  const nonVegItems = catalog.filter((i) => !i.isVeg).sort((a, b) => a.price - b.price);

  const proposedItems = [];
  let allocatedTotal = 0;

  // Allocate vegetarian portions
  if (veg > 0) {
    const targetVegSpend = (budget / people) * veg;
    let vegSpend = 0;
    for (const item of vegItems) {
      if (vegSpend + item.price <= targetVegSpend && proposedItems.length < veg * 2) {
        proposedItems.push({
          itemId: item._id.toString(),
          name: item.name,
          price: item.price,
          quantity: 1,
          isVeg: true,
          restaurantId: item.restaurant?._id?.toString(),
          restaurantName: item.restaurant?.name
        });
        vegSpend += item.price;
        allocatedTotal += item.price;
      }
    }
  }

  // Allocate non-veg portions
  if (nonVeg > 0) {
    const targetNonVegSpend = budget - allocatedTotal;
    let nonVegSpend = 0;
    const pool = nonVegItems.length ? nonVegItems : vegItems;
    for (const item of pool) {
      if (nonVegSpend + item.price <= targetNonVegSpend && proposedItems.length < people * 2) {
        proposedItems.push({
          itemId: item._id.toString(),
          name: item.name,
          price: item.price,
          quantity: 1,
          isVeg: item.isVeg,
          restaurantId: item.restaurant?._id?.toString(),
          restaurantName: item.restaurant?.name
        });
        nonVegSpend += item.price;
        allocatedTotal += item.price;
      }
    }
  }

  return {
    totalPeople: people,
    vegPortions: veg,
    nonVegPortions: nonVeg,
    proposedItems,
    calculatedTotal: allocatedTotal,
    budgetRemaining: budget - allocatedTotal,
    explanation: `Constructed balanced meal for ${people} people (${veg} veg, ${nonVeg} non-veg) totaling ₹${allocatedTotal} within your ₹${budget} budget.`
  };
}

// Tool definitions for Gemini Agent
const agentTools = [
  {
    functionDeclarations: [
      {
        name: 'searchCatalog',
        description: 'Search available menu items across partner restaurants matching cuisine, spice, budget, or name.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: 'Search keywords like spicy, pizza, burger, biryani' },
            maxPrice: { type: Type.NUMBER, description: 'Maximum price threshold per dish in INR' },
            isVeg: { type: Type.BOOLEAN, description: 'True for purely vegetarian items' },
            restaurantId: { type: Type.STRING, description: 'Optional specific restaurant ID' }
          }
        }
      },
      {
        name: 'inspectAndOptimizeCart',
        description: 'Analyze current cart items for bundle discounts, redundant items, and cost optimization.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            cartItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  menuItem: { type: Type.STRING },
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  quantity: { type: Type.NUMBER }
                }
              },
              description: 'List of items currently in cart'
            }
          },
          required: ['cartItems']
        }
      },
      {
        name: 'generateGroupMealPlan',
        description: 'Construct a group order combination adhering to group size, vegetarian dietary constraints, and total budget.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            totalPeople: { type: Type.NUMBER, description: 'Total number of members ordering' },
            vegCount: { type: Type.NUMBER, description: 'Number of strict vegetarians in group' },
            maxBudget: { type: Type.NUMBER, description: 'Hard total budget in INR' },
            restaurantId: { type: Type.STRING, description: 'Optional target restaurant ID' }
          },
          required: ['totalPeople', 'maxBudget']
        }
      }
    ]
  }
];

// =============================================================
// NEW ROUTE: AGENTIC COMMERCE (TRACK 01)
// POST /api/ai/agent
// =============================================================

router.post('/agent', async (req, res) => {
  const auditLogs = [];
  const addAudit = (step, detail) => {
    const timestamp = new Date().toLocaleTimeString('en-IN', { hour12: false });
    auditLogs.push({ time: timestamp, step, detail });
  };

  try {
    const { prompt, cart = [], activeGroupCode = null } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ message: 'A natural language query is required.' });
    }

    addAudit('Request Ingestion', `User input: "${prompt.trim()}"`);

    const ai = getGeminiAI();
    if (!ai) {
      addAudit('Error', 'GEMINI_API_KEY missing on backend');
      return res.status(500).json({
        message: 'Gemini AI is not configured on the backend.',
        auditTrail: auditLogs
      });
    }

    let groupOrderContext = null;
    if (activeGroupCode) {
      groupOrderContext = await Order.findOne({
        groupCode: activeGroupCode.toUpperCase(),
        isGroupOrder: true
      })
        .populate('restaurant', 'name')
        .lean();

      if (groupOrderContext) {
        addAudit('Context Binding', `Bound active group room #${activeGroupCode}`);
      }
    }

    const systemInstruction = `
You are the Foodie AI Commerce Agent for Razorpay Buildathon Track 01.
Your duty is to assist users from intent to checkout using REAL catalog items.
RULES:
1. NEVER invent dishes or prices. Only use data returned by the provided tools.
2. If the user asks for food, search the catalog first via searchCatalog.
3. If the user wants to order for a group, call generateGroupMealPlan.
4. If the user wants to optimize their cart or save money, call inspectAndOptimizeCart.
5. Provide concise, friendly explanations highlighting spice, dietary constraints, and budget fit.
Current Cart Context: ${JSON.stringify(cart)}
Group Room Context: ${groupOrderContext ? JSON.stringify(groupOrderContext) : 'None'}
`;

    addAudit('Intent Classification', 'Evaluating constraints (budget, veg/non-veg, group size, cart context)');

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction,
        tools: agentTools,
        temperature: 0.2
      }
    });

    let finalAssistantText = '';
    let toolCallResult = null;
    let proposedActions = null;

    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      addAudit('Tool Invoked', `Executing tool: ${call.name}`);

      if (call.name === 'searchCatalog') {
        toolCallResult = await toolSearchCatalog(call.args);
        addAudit('Catalog Query', `Found ${toolCallResult.length} matching dishes in MongoDB`);
      } else if (call.name === 'inspectAndOptimizeCart') {
        toolCallResult = await toolInspectAndOptimizeCart({
          cartItems: call.args.cartItems || cart
        });
        addAudit('Cart Optimization', `Evaluated savings: ₹${toolCallResult.savings}`);
      } else if (call.name === 'generateGroupMealPlan') {
        toolCallResult = await toolGenerateGroupMealPlan(call.args);
        addAudit('Group Plan Engine', `Composed meal for ${call.args.totalPeople} people totaling ₹${toolCallResult.calculatedTotal}`);
      }

      const followUp = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          { role: 'user', parts: [{ text: prompt }] },
          { role: 'model', parts: [{ functionCall: call }] },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: call.name,
                  response: { result: toolCallResult }
                }
              }
            ]
          }
        ],
        config: { systemInstruction }
      });

      finalAssistantText = followUp.text;

      if (call.name === 'generateGroupMealPlan' && toolCallResult.proposedItems) {
        proposedActions = {
          type: 'POPULATE_GROUP_ORDER',
          items: toolCallResult.proposedItems,
          totalAmount: toolCallResult.calculatedTotal,
          requiresApproval: true
        };
      } else if (call.name === 'searchCatalog' && toolCallResult.length > 0) {
        proposedActions = {
          type: 'RECOMMENDATION_LIST',
          items: toolCallResult,
          requiresApproval: false
        };
      } else if (call.name === 'inspectAndOptimizeCart' && toolCallResult.savings > 0) {
        proposedActions = {
          type: 'APPLY_CART_OPTIMIZATION',
          savings: toolCallResult.savings,
          newTotal: toolCallResult.optimizedTotal,
          requiresApproval: true
        };
      }
    } else {
      finalAssistantText = response.text;
      addAudit('Direct Response', 'Completed conversational response without external tool calls');
    }

    addAudit('Decision Completed', 'Awaiting human authorization for any financial operations');

    return res.json({
      reply: finalAssistantText,
      data: toolCallResult,
      proposedActions,
      auditTrail: auditLogs
    });
  } catch (error) {
    console.error('Agent processing error:', error);
    addAudit('Error Encountered', error.message || 'Processing failed');
    return res.status(500).json({
      message: 'Agent could not complete request.',
      error: error.message,
      auditTrail: auditLogs
    });
  }
});

// =============================================================
// LEGACY ROUTE: BACKWARD COMPATIBLE RECOMMENDATION
// POST /api/ai/recommend
// =============================================================

router.post('/recommend', async (req, res) => {
  try {
    const { query } = req.body;

    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        message: 'Please tell me what you are looking for.',
        recommendations: [],
      });
    }

    const cleanQuery = query.trim();
    const ai = getGeminiAI();

    if (!ai) {
      return res.status(500).json({
        message: 'Gemini AI is not configured on the backend. Please check GEMINI_API_KEY in Render Environment Variables.',
        recommendations: [],
      });
    }

    const restaurants = await Restaurant.find({}).lean();
    const menuItems = await MenuItem.find({}).lean();

    if (menuItems.length === 0) {
      return res.json({
        message: 'There are no menu items available yet. Please add some dishes from the admin panel. 🍽️',
        recommendations: [],
      });
    }

    const availableFoods = createAvailableFoods(restaurants, menuItems);
    if (availableFoods.length === 0) {
      return res.json({
        message: 'There are no valid menu items connected to restaurants yet. 🍽️',
        recommendations: [],
      });
    }

    const candidates = getCandidates(availableFoods, cleanQuery);
    if (candidates.length === 0) {
      return res.json({
        message: `I couldn't find a suitable match for "${cleanQuery}". Try another food or preference. 🤔`,
        recommendations: [],
      });
    }

    const candidateDatabase = candidates.map((item) => ({
      menuItemId: item.menuItemId,
      restaurantId: item.restaurantId,
      restaurantName: item.restaurantName,
      menuItemName: item.menuItemName,
      description: item.description,
      price: item.price,
      isVeg: item.isVeg,
      cuisine: item.cuisine,
      rating: item.restaurantRating,
    }));

    const prompt = `
You are a fast food recommendation engine.
USER REQUEST: "${cleanQuery}"
CANDIDATE MENU ITEMS: ${JSON.stringify(candidateDatabase)}
Rules:
1. ONLY choose items from the candidate list.
2. NEVER invent a restaurant, item, ID, or price.
3. Recommend at most 5 items.
4. If the request says vegetarian, choose only isVeg=true.
Return JSON only matching the schema.
`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  menuItemId: { type: 'string' },
                  restaurantId: { type: 'string' },
                  reason: { type: 'string' },
                },
                required: ['menuItemId', 'restaurantId', 'reason'],
              },
            },
            message: { type: 'string' },
          },
          required: ['recommendations', 'message'],
        },
        maxOutputTokens: 2000,
      },
    });

    const responseText = response.text?.trim();
    if (!responseText) throw new Error('Gemini returned an empty response.');

    let aiResult;
    try {
      aiResult = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON:', responseText);
      return res.json({
        message: 'Could not format recommendations properly.',
        recommendations: [],
      });
    }

    const menuMap = new Map();
    for (const item of menuItems) menuMap.set(String(item._id), item);
    const restaurantMap = createRestaurantMap(restaurants);

    const validatedRecommendations = [];
    const seenMenuItems = new Set();

    for (const rec of aiResult.recommendations || []) {
      if (!rec?.menuItemId || !rec?.restaurantId) continue;

      const menuItem = menuMap.get(String(rec.menuItemId));
      const restaurant = restaurantMap.get(String(rec.restaurantId));

      if (!menuItem || !restaurant) continue;
      if (String(menuItem.restaurant) !== String(restaurant._id)) continue;

      const menuKey = String(menuItem._id);
      if (seenMenuItems.has(menuKey)) continue;
      seenMenuItems.add(menuKey);

      validatedRecommendations.push({
        restaurantId: restaurant._id,
        restaurantName: restaurant.name,
        restaurantImage: restaurant.image || null,
        restaurantRating: restaurant.rating || 0,
        cuisine: restaurant.cuisine || [],
        location: restaurant.location || '',
        deliveryTime: restaurant.deliveryTime || null,
        priceForTwo: restaurant.priceForTwo || null,
        menuItemId: menuItem._id,
        menuItemName: menuItem.name,
        menuItemDescription: menuItem.description || '',
        price: menuItem.price,
        isVeg: menuItem.isVeg,
        reason: rec.reason || 'This dish matches your request.',
      });

      if (validatedRecommendations.length >= 5) break;
    }

    return res.json({
      message: aiResult.message || `I found ${validatedRecommendations.length} great options for you! 🍽️`,
      recommendations: validatedRecommendations,
    });
  } catch (error) {
    console.error('AI recommendation error:', error);
    return res.status(500).json({
      message: error.message || 'Could not generate recommendations.',
      recommendations: [],
    });
  }
});

// =============================================================
// EXPORT
// =============================================================

export default router;
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import MenuItem from '../models/MenuItem.js';
import Restaurant from '../models/Restaurant.js';

const router = express.Router();

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// =========================================================
// TOOL DEFINITIONS
// =========================================================
const searchCatalogDeclaration = {
  name: 'searchCatalog',
  description:
    'Search the real restaurant catalog for dishes matching user preferences, constraints, budgets, dietary needs (veg/non-veg, high protein, low carb, healthy, etc.), or specific food names.',
  parameters: {
    type: 'OBJECT',
    properties: {
      query: {
        type: 'STRING',
        description:
          'Keywords for matching food names, categories, or keywords in description (e.g., "chicken", "protein", "paneer", "salad", "pizza", "healthy").'
      },
      maxPrice: {
        type: 'NUMBER',
        description: 'Maximum budget or price constraint in INR (e.g. 300 for under ₹300).'
      },
      isVeg: {
        type: 'BOOLEAN',
        description: 'True if user strictly wants Vegetarian, false for Non-Vegetarian.'
      },
      restaurantId: {
        type: 'STRING',
        description: 'Optional restaurant ID filter.'
      }
    }
  }
};

const functions = {
  searchCatalog: async ({ query = '', maxPrice, isVeg, restaurantId }) => {
    let filter = {};

    // 1. Price constraint
    if (typeof maxPrice === 'number' && maxPrice > 0) {
      filter.price = { $lte: maxPrice };
    }

    // 2. Vegetarian constraint
    if (typeof isVeg === 'boolean') {
      filter.isVeg = isVeg;
    }

    // 3. Restaurant filter
    if (restaurantId) {
      filter.restaurant = restaurantId;
    }

    // 4. Keyword / Natural Language matching
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();

      // Handle natural language terms that map to real database content
      let searchTerms = [q];
      if (q.includes('protein')) {
        searchTerms.push('chicken', 'egg', 'paneer', 'mutton', 'fish', 'tofu', 'soya', 'grilled');
      }
      if (q.includes('carb')) {
        searchTerms.push('salad', 'soup', 'grilled', 'roast', 'tandoori', 'chicken', 'paneer');
      }
      if (q.includes('healthy') || q.includes('light')) {
        searchTerms.push('salad', 'soup', 'steamed', 'grilled', 'sprouts');
      }

      const regexPattern = searchTerms.join('|');

      filter.$or = [
        { name: { $regex: regexPattern, $options: 'i' } },
        { description: { $regex: regexPattern, $options: 'i' } },
        { category: { $regex: regexPattern, $options: 'i' } }
      ];
    }

    const items = await MenuItem.find(filter)
      .populate('restaurant', 'name image location')
      .limit(10)
      .lean();

    return items.map((it) => ({
      itemId: it._id.toString(),
      name: it.name,
      price: it.price,
      isVeg: it.isVeg,
      category: it.category || '',
      description: it.description || '',
      restaurantId: it.restaurant ? it.restaurant._id.toString() : null,
      restaurantName: it.restaurant ? it.restaurant.name : 'Partner Restaurant',
      image: it.image || (it.restaurant && it.restaurant.image) || null
    }));
  }
};

// SYSTEM INSTRUCTION TO STRICTLY ENFORCE TOOL USAGE FOR FOOD QUERIES
const SYSTEM_INSTRUCTION = `
You are the AI Food Commerce Assistant for "Foodie".
Your primary function is helping users discover real dishes from the catalog and build/optimize their carts.

CRITICAL RULES:
1. If the user asks for food, dishes, recommendations, menu items, dietary options ("high protein", "low carb", "healthy"), budgets ("under 300"), or cuisines, YOU MUST ALWAYS CALL searchCatalog FIRST.
2. DO NOT respond with text like "I found the information you requested" or recommend foods without calling searchCatalog.
3. Extract constraints from natural language query:
   - "high protein and low carbs" -> query: "protein chicken egg paneer salad"
   - "under ₹300" -> maxPrice: 300
   - "vegetarian" -> isVeg: true
   - "chicken" -> query: "chicken"
4. Base recommendations strictly on real catalog results returned by searchCatalog. Do not invent exact nutritional values unless present in catalog data.
5. Provide a short, polite explanation in plain conversational English without markdown symbols like **, *, or ###.
`;

// =========================================================
// POST /api/ai/agent
// =========================================================
router.post('/agent', async (req, res) => {
  const auditTrail = [];
  const addAudit = (step, detail) => {
    auditTrail.push({
      time: new Date().toISOString().split('T')[1].slice(0, 8),
      step,
      detail
    });
  };

  try {
    const { prompt, cart = [], activeGroupCode } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ message: 'Prompt is required.' });
    }

    addAudit('Request Ingestion', `Received prompt: "${prompt}"`);

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: [searchCatalogDeclaration] }]
    });

    const chat = model.startChat();
    addAudit('Intent Classification', 'Evaluating tool requirements...');

    let response = await chat.sendMessage(prompt);
    let candidate = response.response.candidates[0];
    let functionCalls = candidate?.content?.parts?.filter((p) => p.functionCall);

    let catalogItems = [];

    // Loop through function calls requested by Gemini
    while (functionCalls && functionCalls.length > 0) {
      for (const callPart of functionCalls) {
        const call = callPart.functionCall;
        addAudit('Tool Invoked', `Executing function: ${call.name}`);

        if (functions[call.name]) {
          const toolResult = await functions[call.name](call.args);
          addAudit(
            'Catalog Query',
            `Found ${Array.isArray(toolResult) ? toolResult.length : 0} matching items`
          );

          if (call.name === 'searchCatalog' && Array.isArray(toolResult)) {
            catalogItems = toolResult;
          }

          // Send function execution result back while preserving history
          response = await chat.sendMessage([
            {
              functionResponse: {
                id: call.id,
                name: call.name,
                response: { result: toolResult }
              }
            }
          ]);
        }
      }

      candidate = response.response.candidates[0];
      functionCalls = candidate?.content?.parts?.filter((p) => p.functionCall);
    }

    // Final textual explanation from model
    const textPart = candidate?.content?.parts?.find((p) => p.text);
    const textReply = textPart ? textPart.text.trim() : 'Here are the options from our menu.';

    addAudit('Decision Completed', 'Formulated response with catalog recommendations.');

    // Construct response
    const payload = {
      reply: textReply,
      auditTrail
    };

    if (catalogItems.length > 0) {
      payload.proposedActions = {
        type: 'RECOMMENDATION_LIST',
        items: catalogItems,
        requiresApproval: false
      };
      payload.data = catalogItems;
    }

    return res.json(payload);
  } catch (error) {
    console.error('AI Agent Error:', error);
    return res.status(500).json({
      message: error.message || 'AI processing error',
      auditTrail
    });
  }
});

// Legacy endpoint fallback
router.post('/recommend', async (req, res) => {
  try {
    const { query } = req.body;
    const items = await functions.searchCatalog({ query });
    return res.json({
      message: `Found options for "${query}"`,
      recommendations: items
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
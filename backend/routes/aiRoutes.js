/**
 * AI Assistant Routes - Smart City Dashboard (Backend)
 */

const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

/**
 * POST /api/ai/chat
 * Accepts { message, context } and returns AI reply based on current context.
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, context, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A valid "message" string is required in the request body.'
      });
    }

    const result = await aiService.askGemini(message.trim(), context, history);

    res.json({
      success: true,
      data: {
        reply: result.reply,
        action: result.action
      }
    });
  } catch (error) {
    console.error('[AI Chat Route Error]:', error.message);

    const isClientError = error.message.includes('not configured') || error.message.includes('required');
    res.status(isClientError ? 400 : 500).json({
      success: false,
      error: error.message || 'AI Assistant is temporarily unavailable. Please try again.'
    });
  }
});

module.exports = router;

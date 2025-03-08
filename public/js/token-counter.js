// Token counter using a simplified algorithm based on tiktoken
class TokenCounter {
  constructor() {
    // Average tokens per character for different languages (approximately)
    this.avgTokensPerChar = {
      english: 0.25, // ~4 chars per token
      code: 0.35,    // ~3 chars per token for code
    };
    
    // Model token limits
    this.modelLimits = {
      'gpt-3.5-turbo': 16385,
      'gpt-4': 8192,
      'gpt-4-turbo': 128000,
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'o1': 32000,
      'o1-mini': 32000,
      'o3-mini': 128000
    };
  }
  
  // Estimate token count for a text string
  estimateTokenCount(text, type = 'english') {
    if (!text) return 0;
    
    // Use the right ratio based on content type
    const ratio = this.avgTokensPerChar[type] || this.avgTokensPerChar.english;
    
    // Special handling for code blocks which have different token counts
    if (type === 'english') {
      // Find code blocks and replace with placeholders
      const codeBlockRegex = /```[\s\S]*?```/g;
      const codeBlocks = text.match(codeBlockRegex) || [];
      
      // Count tokens for code blocks separately
      let codeBlockTokens = 0;
      codeBlocks.forEach(block => {
        codeBlockTokens += Math.ceil(block.length * this.avgTokensPerChar.code);
      });
      
      // Replace code blocks with empty space to avoid double counting
      const textWithoutCode = text.replace(codeBlockRegex, '');
      
      // Calculate tokens for regular text
      const regularTextTokens = Math.ceil(textWithoutCode.length * ratio);
      
      // Return total count
      return regularTextTokens + codeBlockTokens;
    }
    
    // Simple estimate for non-mixed content
    return Math.ceil(text.length * ratio);
  }
  
  // Get token limit for a specific model
  getTokenLimit(model) {
    return this.modelLimits[model] || 4096; // Default fallback
  }
  
  // Check if approaching limit
  getUsageLevel(count, limit) {
    const ratio = count / limit;
    if (ratio > 0.9) return 'danger';
    if (ratio > 0.75) return 'warning';
    return 'normal';
  }
}

// Export for use in other modules
window.TokenCounter = TokenCounter;
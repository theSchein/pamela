export const searchMarketsTemplate = `
Given the following user message about markets, extract the search intent and keywords.

User message: {{text}}

Analyze the message and respond with a JSON object containing:
1. "searchType": One of:
   - "specific" (user wants markets about a specific topic)
   - "popular" (user wants trending/popular markets)
   - "category" (user wants markets in a specific category)
   - "general" (user wants to browse markets)

2. "searchTerm": The specific term to search for (or empty string if searchType is "popular" or "general")
   - Extract just the topic, not the full phrase
   - For "tell me about F1 markets", extract "F1"
   - For "show bitcoin prediction markets", extract "bitcoin"
   - For "what election markets are there", extract "election"

3. "confidence": A number from 0 to 1 indicating confidence in the extraction

Examples:
- "tell me about F1 markets" -> {"searchType": "specific", "searchTerm": "F1", "confidence": 0.95}
- "show me some popular markets" -> {"searchType": "popular", "searchTerm": "", "confidence": 0.90}
- "what markets are trending" -> {"searchType": "popular", "searchTerm": "", "confidence": 0.85}
- "bitcoin markets" -> {"searchType": "specific", "searchTerm": "bitcoin", "confidence": 0.95}
- "show me sports betting markets" -> {"searchType": "category", "searchTerm": "sports", "confidence": 0.85}

Respond with only the JSON object, no additional text.
`;
# Qwen Chat with Web Search

Your AI chat application now includes **web search capability** to provide current, real-time information in responses.

## Features

✅ **Web Search Integration** - Search the web and include results in chat context  
✅ **Two Search Backends**:
   - **Primary**: Tavily API (optimized for LLM context)
   - **Fallback**: DuckDuckGo API (free, no API key required)  
✅ **Toggle Control** - Enable/disable search per message  
✅ **Seamless Integration** - Search results automatically formatted and included in prompts

## How to Use

1. **Open the Chat UI** - Navigate to `http://localhost:3000`

2. **Enable Web Search** - Toggle the "Web Search" option in the left sidebar

3. **Ask a Question** - Type any question and send. The app will:
   - Search the web for current information
   - Display "Searching the web..." while fetching results
   - Include search results in the message context
   - Get more accurate, up-to-date responses from the model

4. **Toggle Search On/Off** - Control when web search is used for individual messages

## Setup

### Using free search (DuckDuckGo)
No setup needed! The search server uses DuckDuckGo's free API by default.

### Using Tavily API (Optional - Better Results)
For higher quality search results optimized for LLM use:

1. Get a free API key from [tavily.com](https://tavily.com)
2. Set the environment variable before starting:
   ```bash
   export TAVILY_API_KEY="your-api-key-here"
   ```
3. Restart the application:
   ```bash
   sudo docker compose down
   bash start.sh
   ```

## Architecture

```
Chat UI (http://3000)
  ├── vLLM API (http://8000) - Language model inference
  ├── Search Server (http://8001) - Web search proxy
  └── Nginx (reverse proxy)
```

### Services

- **search-server**: Python-based search proxy that handles both Tavily and DuckDuckGo
- **vllm**: Qwen 3.5-122B model serving via OpenAI-compatible API
- **ai-chat-ui**: Frontend chat interface with web search integration
- **chat (nginx)**: Static file serving and reverse proxy

## Search Result Format

When web search is enabled, results are formatted as:

```
--- Web Search Results for "query" (DuckDuckGo/Tavily API) ---

1. Result Title
   URL: https://example.com
   Snippet: Relevant excerpt from the page...

2. Next Result
   ...

--- End of Search Results ---
```

These results are automatically included in your message context, allowing the model to provide informed, current answers.

## Troubleshooting

**Search not working?**
- Check that the search server is running: `sudo docker compose ps | grep search-server`
- View logs: `sudo docker compose logs search-server`
- Test manually: `curl http://localhost:8001/search?q=test`

**Tavily API not working?**
- Verify your API key is set: `echo $TAVILY_API_KEY`
- Check if the key is valid on [tavily.com](https://tavily.com)
- The system will automatically fall back to DuckDuckGo if Tavily fails

**Slow searches?**
- DuckDuckGo is faster but sometimes less comprehensive
- Tavily typically has better results but requires an API key
- Search timeout is set to 10 seconds

## API Endpoints

- **Search API**: `GET /search?q=query`
  - Returns JSON with results array
  - Available locally at `http://localhost:8001/search`

## Files Changed

- `search_server.py` - New search proxy service
- `docker-compose.yml` - Added search service container
- `nginx.conf` - Added search API routing
- `chat/index.html` - Added web search toggle and integration

## Next Steps

- **Customize system prompt** to leverage web search information
- **Adjust search result count** (currently limited to 5 results per query)
- **Add custom search filters** by modifying `search_server.py`
- **Monitor search usage** in docker compose logs

Enjoy informed, current responses with web search! 🌐

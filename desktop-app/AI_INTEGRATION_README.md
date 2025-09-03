# Flow Desk AI Engine Integration

A complete, production-ready AI integration for Flow Desk featuring OpenAI API support, streaming responses, secure key management, and comprehensive UI components.

## 🚀 Features

### Core AI Engine
- **Multi-Provider Support**: OpenAI and DeepSeek with extensible provider architecture
- **Streaming Responses**: Real-time AI responses with proper streaming support
- **Advanced Caching**: Intelligent response caching with configurable TTL
- **Rate Limiting**: Comprehensive rate limiting with provider-specific limits
- **Key Management**: Secure API key storage with multiple backend options
- **Error Handling**: Robust error handling with detailed error types
- **Usage Tracking**: Detailed usage statistics and cost tracking

### Integration Layers
- **Rust Engine**: High-performance core implementation in Rust
- **NAPI Bindings**: Native Node.js bindings for seamless integration
- **CLI Interface**: Command-line interface for server-side operations
- **React Components**: Production-ready UI components for chat and settings
- **TypeScript Client**: Type-safe API client for frontend integration

### UI Components
- **Chat Interface**: Modern chat UI with message history and streaming
- **Settings Panel**: Comprehensive settings for API keys and provider management
- **Health Monitoring**: Real-time provider health and status indicators
- **Usage Analytics**: Visual usage statistics and cost tracking

## 📁 Project Structure

```
src/lib/rust-engine/src/ai/
├── mod.rs                    # Main AI engine module
├── client.rs                 # Multi-provider AI client
├── config.rs                 # Configuration management
├── error.rs                  # Error handling
├── key_manager.rs           # Secure API key management
├── types.rs                  # Core AI types
├── cache.rs                  # Response caching
├── rate_limiter.rs          # Rate limiting
├── napi.rs                   # Node.js bindings
└── providers/
    ├── mod.rs               # Provider registry
    ├── openai.rs            # OpenAI provider with streaming
    └── deepseek.rs          # DeepSeek provider

src/renderer/components/ai/
├── AIPage.tsx               # Main AI page component
├── AIChatInterface.tsx      # Chat interface component
├── AISettingsPanel.tsx     # Settings panel component
├── AIClient.ts              # TypeScript API client
├── useAI.ts                 # React hook for AI state
└── index.ts                 # Component exports

bin/
└── flow_desk_cli.rs         # CLI with AI commands
```

## 🛠 Setup and Installation

### 1. Build the Rust Engine

```bash
cd src/lib/rust-engine
cargo build --release --bin flow_desk_cli
cargo build --release --features napi
```

### 2. Install Node.js Dependencies

```bash
npm install
npm run build:rust
```

### 3. Run Integration Tests

```bash
# Test Rust integration
cd src/lib/rust-engine
cargo test ai_integration_test

# Test NAPI bindings
node test-ai-integration.js

# Test CLI interface
node test-cli-ai.js
```

## 🔑 API Key Configuration

### Through the UI
1. Open Flow Desk
2. Navigate to Settings > AI
3. Enter your OpenAI API key
4. Test the connection
5. Start chatting!

### Through CLI
```bash
echo '{"function": "ai_store_key", "args": ["openai", "sk-your-api-key"]}' | ./flow_desk_cli
```

### Environment Variables
```bash
export FLOW_DESK_OPENAI_API_KEY="sk-your-api-key"
export FLOW_DESK_DEEPSEEK_API_KEY="your-deepseek-key"
```

## 💻 Usage Examples

### TypeScript/React Integration

```typescript
import { useAI, AIPage } from './components/ai';

// Using the AI hook
function MyComponent() {
  const ai = useAI();
  
  const handleSendMessage = async () => {
    await ai.sendMessage('Hello, AI!', {
      temperature: 0.7,
      maxTokens: 1000
    });
  };
  
  return (
    <div>
      <button onClick={handleSendMessage}>
        Send Message
      </button>
      {ai.messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  );
}

// Using the complete AI page
function App() {
  return <AIPage />;
}
```

### Direct Client Usage

```typescript
import { aiClient } from './components/ai';

async function example() {
  // Initialize
  await aiClient.initialize();
  
  // Store API key
  await aiClient.storeApiKey('openai', 'sk-your-key');
  
  // Send completion
  const response = await aiClient.createCompletion({
    model: 'gpt-4',
    messages: [
      aiClient.createUserMessage('Hello!')
    ],
    temperature: 0.7
  });
  
  console.log(response.content);
}
```

### CLI Usage

```bash
# Initialize AI engine
echo '{"function": "init_ai_engine"}' | ./flow_desk_cli

# Store API key
echo '{"function": "ai_store_key", "args": ["openai", "sk-your-key"]}' | ./flow_desk_cli

# Send completion
echo '{"function": "ai_completion", "args": ["gpt-4", "Hello!", 0.7, 100]}' | ./flow_desk_cli

# Check health
echo '{"function": "ai_health"}' | ./flow_desk_cli

# Get usage stats
echo '{"function": "ai_usage_stats"}' | ./flow_desk_cli
```

## 🔧 Configuration

### AI Engine Config

```typescript
const config = {
  cachePath: './ai_cache',
  enableCaching: true,
  enableStreaming: true,
  defaultModel: 'gpt-4',
  timeoutSeconds: 30,
  providers: {
    openai: {
      apiKey: 'sk-your-key',
      models: ['gpt-4', 'gpt-3.5-turbo'],
      maxRetries: 3
    },
    deepseek: {
      apiKey: 'your-deepseek-key',
      models: ['deepseek-chat'],
      maxRetries: 3
    }
  }
};
```

### Provider Configuration

```rust
let provider_config = ProviderConfig {
    api_key: Some("sk-your-key".to_string()),
    api_base: Some("https://api.openai.com/v1".to_string()),
    organization: None,
    default_model: "gpt-4".to_string(),
    timeout_seconds: 30,
    max_retries: 3,
    enabled: true,
};
```

## 📊 Monitoring and Analytics

### Usage Statistics
- Total requests and success rates
- Token usage and cost tracking
- Average response times
- Provider-specific metrics

### Health Monitoring
- Provider availability status
- API key validation
- Rate limit monitoring
- Error rate tracking

### Caching Metrics
- Cache hit/miss ratios
- Cache size and performance
- TTL effectiveness

## 🔒 Security Features

### API Key Management
- **Memory Storage**: Fast, secure in-memory storage
- **Keyring Storage**: OS-level secure key storage
- **Environment Variables**: Standard env var support
- **Encrypted Storage**: File-based encrypted storage

### Data Security
- Keys are never logged in plain text
- Automatic key rotation support
- Secure memory handling with zeroization
- Request/response sanitization

## 🚦 Error Handling

The AI engine provides comprehensive error handling:

```rust
pub enum AIError {
    Authentication { message: String },
    RateLimit { message: String, retry_after_seconds: u64 },
    InvalidInput { message: String },
    Network { message: String },
    Provider { provider: String, message: String },
    Internal { message: String },
    Configuration { message: String },
}
```

All errors include:
- Detailed error messages
- Error codes and types
- Retry information where applicable
- Context about the failed operation

## 🔄 Streaming Support

Real-time streaming responses with proper chunk handling:

```typescript
await aiClient.createStreamingCompletion(request, (chunk) => {
  console.log('Received chunk:', chunk.content);
  updateUI(chunk);
});
```

## 📈 Performance Optimizations

- **Connection pooling** for HTTP requests
- **Request batching** for efficiency
- **Intelligent caching** with TTL
- **Memory management** with automatic cleanup
- **Concurrent request handling**
- **Streaming for improved UX**

## 🧪 Testing

### Unit Tests
```bash
cd src/lib/rust-engine
cargo test
```

### Integration Tests
```bash
cargo test ai_integration_test
node test-ai-integration.js
node test-cli-ai.js
```

### Manual Testing
1. Start the application
2. Open AI settings
3. Add your OpenAI API key
4. Test a completion request
5. Verify streaming responses work
6. Check usage statistics

## 🐛 Troubleshooting

### Common Issues

**"AI engine not initialized"**
- Ensure the Rust library is built
- Check cache directory permissions
- Verify NAPI bindings are loaded

**"No API key configured"**
- Add API key through settings UI
- Set environment variables
- Check keyring access permissions

**"Provider unhealthy"**
- Verify API key is valid
- Check internet connection
- Confirm API endpoint accessibility

**"Rate limit exceeded"**
- Wait for rate limit reset
- Consider using multiple API keys
- Adjust request frequency

### Debug Logging

```bash
# Enable debug logging
export RUST_LOG=debug
export NODE_ENV=development

# Run with verbose output
RUST_LOG=flow_desk_shared::ai=trace npm start
```

## 📚 API Reference

### Core Types

```typescript
interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface CompletionRequest {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface CompletionResponse {
  id: string;
  model: string;
  content: string;
  usage?: TokenUsage;
}
```

### CLI Commands

| Command | Description | Example |
|---------|-------------|---------|
| `init_ai_engine` | Initialize AI engine | `{"function": "init_ai_engine"}` |
| `ai_store_key` | Store API key | `{"function": "ai_store_key", "args": ["openai", "key"]}` |
| `ai_completion` | Create completion | `{"function": "ai_completion", "args": ["gpt-4", "Hello"]}` |
| `ai_models` | List models | `{"function": "ai_models"}` |
| `ai_health` | Health check | `{"function": "ai_health"}` |
| `ai_usage_stats` | Usage statistics | `{"function": "ai_usage_stats"}` |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for their excellent API
- The Rust community for amazing crates
- NAPI-RS for seamless Node.js integration
- React community for UI components

---

**Ready to integrate AI into your Flow Desk application!** 🚀

For support, please open an issue on GitHub or contact the development team.
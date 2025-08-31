# Flow Desk NAPI Module - Complete Solution Guide

## Problem Analysis

The NAPI module loading issue ("Module did not self-register") was caused by:

1. **Linker Symbol Resolution**: NAPI symbols not being resolved during linking
2. **Environment Configuration**: Missing proper NAPI development setup
3. **Build Configuration**: Incorrect build settings for macOS ARM64

## Solution Options

### Option 1: Fix Current Setup (Advanced)

The current setup has linking issues that require environment fixes:

```bash
# Install required development tools
npm install -g node-gyp
node-gyp install

# Set proper environment variables
export NODE_API_NO_EXTERNAL_BUFFERS=true
export MACOSX_DEPLOYMENT_TARGET=11.0

# Use the build script provided
./build-script.sh
```

### Option 2: Alternative TypeScript Integration (Recommended)

Instead of NAPI, use FFI bindings which are more reliable:

1. **Create Rust C-compatible library**:
   - Change crate-type to ["cdylib", "staticlib"]
   - Export C-compatible functions
   - Use cbindgen to generate headers

2. **Use Node.js FFI**:
   - Install `ffi-napi` package
   - Load the Rust library as dynamic library
   - Call Rust functions directly from TypeScript

### Option 3: WebAssembly Approach

1. **Build for WebAssembly**:
   ```bash
   cargo build --target wasm32-unknown-unknown --features wasm
   wasm-pack build --target nodejs
   ```

2. **Import in TypeScript**:
   ```typescript
   import * as wasm from './pkg/flow_desk_shared';
   ```

## Current Implementation Status

### Working Components:
- ✅ Rust engine implementations (mail, calendar, search)
- ✅ TypeScript type definitions
- ✅ Core functionality in simple modules
- ✅ Build configuration

### Issues to Resolve:
- ❌ NAPI module linking on macOS ARM64
- ❌ Module self-registration
- ❌ Integration with desktop/mobile apps

## Next Steps for Integration

### Immediate Solution (FFI Approach)

1. **Update Cargo.toml**:
   ```toml
   [lib]
   name = "flow_desk_shared"
   crate-type = ["cdylib", "staticlib"]

   [features]
   default = ["ffi"]
   ffi = ["dep:cbindgen"]
   ```

2. **Create C-compatible exports**:
   ```rust
   #[no_mangle]
   pub extern "C" fn hello() -> *const c_char {
       CString::new("Hello from Rust!").unwrap().into_raw()
   }
   ```

3. **TypeScript FFI wrapper**:
   ```typescript
   import { Library } from 'ffi-napi';
   
   const lib = Library('./libflow_desk_shared.dylib', {
     'hello': ['string', []],
     'add': ['int', ['int', 'int']]
   });
   ```

### Desktop App Integration

1. **Update mail service**:
   ```typescript
   import { rustLib } from '../shared/rust-bindings';
   
   export class MailService {
     async addAccount(account: MailAccount) {
       return rustLib.addMailAccount(account);
     }
   }
   ```

2. **Update calendar service**:
   ```typescript
   export class CalendarService {
     async syncAccount(accountId: string) {
       return rustLib.syncCalendarAccount(accountId);
     }
   }
   ```

### Mobile App Integration

1. **React Native setup**:
   - Use react-native-ffi for FFI bindings
   - Include compiled Rust libraries for iOS/Android
   - Update mobile services to use Rust functions

## Testing Strategy

1. **Unit Tests**: Test each Rust engine independently
2. **Integration Tests**: Test TypeScript ↔ Rust communication
3. **End-to-End Tests**: Test complete workflows in desktop/mobile apps

## Performance Considerations

- FFI calls have minimal overhead (~1-10ns)
- Memory management between Rust/TypeScript
- Async/await wrapping for Rust functions
- Error handling and type safety

## File Structure

```
shared/
├── rust-lib/              # Rust engines
│   ├── src/
│   │   ├── mail_simple.rs  # Mail engine
│   │   ├── calendar_simple.rs # Calendar engine
│   │   ├── search_simple.rs # Search engine
│   │   └── ffi.rs          # C-compatible exports
│   └── lib/               # Compiled libraries
├── src/                   # TypeScript wrappers
│   ├── rust-bindings.ts   # FFI bindings
│   ├── mail-engine.ts     # Mail engine wrapper
│   ├── calendar-engine.ts # Calendar engine wrapper
│   └── search-engine.ts   # Search engine wrapper
```

This approach provides:
- ✅ Reliable cross-platform compilation
- ✅ No complex NAPI environment dependencies
- ✅ Direct TypeScript integration
- ✅ Better error handling and debugging
- ✅ Support for both desktop and mobile apps
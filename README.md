## Running

### Start fuel

```sh
pnpm node:start
```

or 

```
sh ./.config/start-fuel.sh
```

### Run tests

#### Build

Inside `signature-predicate`;

```
forc build
```

#### Rust SDK

```
cargo test -- --nocapture
```

#### TypeScript SDK

Inside `test-predicate`

```sh
pnpm install &&
pnpm test
```

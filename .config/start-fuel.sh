#!/usr/bin/env bash

fuel-core run \
    --ip 0.0.0.0 \
    --port 4000 \
    --db-type in-memory \
    --utxo-validation \
    --min-gas-price 1 \
    --consensus-key 0xa449b1ffee0e2205fa924c6740cc48b3b473aa28587df6dab12abc245d1f5298 \
    --chain ./.config/chainConfig.json

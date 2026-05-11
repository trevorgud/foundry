ARG FOUNDRY_BASE_IMAGE=ghcr.io/felddy/foundryvtt:14.360.0
FROM ${FOUNDRY_BASE_IMAGE}

COPY systems/pawn16 /data/Data/systems/pawn16

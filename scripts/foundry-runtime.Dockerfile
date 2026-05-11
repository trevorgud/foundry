ARG FOUNDRY_BASE_IMAGE=ghcr.io/felddy/foundryvtt:14.360.0
FROM ${FOUNDRY_BASE_IMAGE}

COPY systems/pawn16 /opt/pawn16/pawn16
COPY scripts/pawn16-entrypoint.sh /home/node/pawn16-entrypoint.sh

ENTRYPOINT ["./pawn16-entrypoint.sh"]

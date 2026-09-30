FROM mongo:8.3.11
COPY keyfile /etc/mongo/keyfile
RUN chown mongodb:mongodb /etc/mongo/keyfile && chmod 400 /etc/mongo/keyfile

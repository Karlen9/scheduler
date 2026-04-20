FROM alpine:3.20

RUN apk add --no-cache \
    bash \
    curl \
    openssh-client \
    postgresql16-client \
    tzdata \
    dcron \
    coreutils

ENV TZ=Europe/Moscow

COPY scripts/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh

COPY crontab /etc/crontabs/root

VOLUME ["/backups", "/root/.ssh", "/var/lib/monitor"]

CMD ["/usr/local/bin/entrypoint.sh"]

FROM ruby:4.0.5-alpine

ENV RAILS_ENV=development
ENV EDITOR=vim
WORKDIR /rails

RUN apk add --update --no-cache \
    alpine-sdk \
    nodejs \
    npm \
    tzdata \
    gcompat \
    vim \
    bash \
    openssh \
    yaml-dev \
    curl \
    postgresql-dev
ENV DEVCONTAINER=true

# Persist bash history.
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history"   && mkdir /commandhistory   && touch /commandhistory/.bash_history

RUN mkdir -p /root/.claude

# Install Claude Code (native installation)
RUN curl -fsSL https://claude.ai/install.sh | bash

RUN gem install bundler -v 4.0.14


COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs=2

COPY . .

RUN sed -i 's:/bin/ash:/bin/bash:g' /etc/passwd

EXPOSE 3000

ENTRYPOINT ["./bin/docker-entrypoint"]

CMD ["sleep", "infinity"]

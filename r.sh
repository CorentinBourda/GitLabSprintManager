#!/bin/sh

echo "Reseting migrations..."
bundle exec rake db:migrate:reset || exit 1
echo "Seeding database..."
bundle exec rake db:seed || exit 1
echo "Done !"

# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Ensure the single GitLab configuration row exists so the Settings screen has
# something to edit on first boot.
GitlabConfig.instance

Rails.logger.info "Seeded GitlabConfig (configure your URL + token from the app's Settings tab)."

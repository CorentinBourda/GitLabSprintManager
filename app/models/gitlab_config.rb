# Holds the (single) GitLab API connection settings.
#
# This app is strictly read-only against GitLab: the token is only ever used
# to GET milestones and issues. Nothing is created or mutated on GitLab.
class GitlabConfig < ApplicationRecord
  validates :base_url, presence: true

  # There is only ever one configuration row for this personal tool.
  def self.instance
    first_or_create!(base_url: "https://gitlab.com")
  end

  def configured?
    base_url.present? && token.present?
  end

  # Normalized GitLab API v4 base (e.g. "https://gitlab.com/api/v4").
  def api_base
    "#{base_url.to_s.chomp('/')}/api/v4"
  end
end

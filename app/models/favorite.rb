# A bookmarked sprint (a project + milestone pair) for one-click access from
# the top bar. Purely local; nothing is written to GitLab.
class Favorite < ApplicationRecord
  validates :project_id, :milestone_id, presence: true
  validates :milestone_id, uniqueness: { scope: :project_id }
end

# A locally-tracked project the user works on. Created the moment a GitLab
# project is selected ("start working on a project"), with a random color the
# user can later change. Used to color tickets and the all-day "work on this
# project" bands on the calendar. Never written back to GitLab.
class Project < ApplicationRecord
  # Pleasant, well-separated hues picked at random on creation.
  PALETTE = %w[
    #6366f1 #ec4899 #f97316 #14b8a6 #0ea5e9
    #8b5cf6 #ef4444 #22c55e #eab308 #06b6d4
  ].freeze

  validates :gitlab_project_id, presence: true, uniqueness: true
  validates :name, presence: true
  validates :color, presence: true, format: { with: /\A#[0-9a-fA-F]{6}\z/ }

  before_validation :assign_random_color, on: :create

  private

  # Pick a palette color not already used by another project, so projects are
  # visually distinct. Falls back to a random one once the palette is exhausted.
  def assign_random_color
    return if color.present?

    available = PALETTE - Project.pluck(:color)
    self.color = (available.presence || PALETTE).sample
  end
end

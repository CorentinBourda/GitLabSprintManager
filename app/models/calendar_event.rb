# A purely local calendar entry. Flavours:
#   - "ticket"        : a slot where you plan to work on a given GitLab issue
#   - "project_day"   : an all-day "working on this project" band, auto-created
#                       the first time a ticket of that project is scheduled on a day
#   - "other_project" : a block of time spent on something else
#   - "note"          : a free annotation
#
# These never leave the local database; GitLab is never written to.
class CalendarEvent < ApplicationRecord
  KINDS = %w[ticket project_day other_project note].freeze

  validates :title, presence: true
  validates :kind, inclusion: { in: KINDS }
  validates :starts_at, :ends_at, presence: true
  validate :ends_after_starts

  scope :between, ->(from, to) { where("starts_at < ? AND ends_at > ?", to, from) }

  private

  def ends_after_starts
    return if starts_at.blank? || ends_at.blank?

    errors.add(:ends_at, "must be after the start") if ends_at <= starts_at
  end
end

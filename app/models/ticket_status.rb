# Local workflow marker for a GitLab issue. One marker per (project, issue).
#
# Stored locally only — it mirrors how *you* are progressing on a ticket and is
# never pushed back to GitLab.
class TicketStatus < ApplicationRecord
  STATUSES = %w[not_started in_progress dev_done feedback review_done merged].freeze

  validates :project_id, :issue_iid, presence: true
  validates :issue_iid, uniqueness: { scope: :project_id }
  validates :status, inclusion: { in: STATUSES }

  # Upsert the marker for a given issue.
  def self.set(project_id:, issue_iid:, status:)
    record = find_or_initialize_by(project_id: project_id.to_s, issue_iid: issue_iid)
    record.update!(status: status)
    record
  end
end

class CreateTicketStatuses < ActiveRecord::Migration[7.1]
  def change
    create_table :ticket_statuses do |t|
      t.string :project_id, null: false
      t.integer :issue_iid, null: false
      # not_started | in_progress | dev_done | feedback | review_done | merged
      t.string :status, null: false, default: "not_started"

      t.timestamps
    end

    add_index :ticket_statuses, %i[project_id issue_iid], unique: true
  end
end

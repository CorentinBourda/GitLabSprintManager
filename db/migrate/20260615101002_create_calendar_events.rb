class CreateCalendarEvents < ActiveRecord::Migration[7.1]
  def change
    create_table :calendar_events do |t|
      t.string :title, null: false
      # ticket | other_project | note
      t.string :kind, null: false, default: "ticket"
      t.datetime :starts_at, null: false
      t.datetime :ends_at, null: false
      t.boolean :all_day, null: false, default: false
      # GitLab references (read-only mirror, only used to link a slot to an issue)
      t.string :project_id
      t.integer :issue_iid
      t.string :milestone_id
      t.string :color
      t.text :notes

      t.timestamps
    end

    add_index :calendar_events, :starts_at
    add_index :calendar_events, %i[project_id issue_iid]
  end
end

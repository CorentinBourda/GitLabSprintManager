class CreateProjects < ActiveRecord::Migration[7.1]
  def change
    create_table :projects do |t|
      t.string :gitlab_project_id, null: false
      t.string :name, null: false
      t.string :color, null: false

      t.timestamps
    end

    add_index :projects, :gitlab_project_id, unique: true
  end
end

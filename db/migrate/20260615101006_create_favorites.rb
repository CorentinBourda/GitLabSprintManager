class CreateFavorites < ActiveRecord::Migration[7.1]
  def change
    create_table :favorites do |t|
      t.string :project_id, null: false
      t.string :project_name
      t.string :milestone_id, null: false
      t.string :milestone_title

      t.timestamps
    end

    add_index :favorites, %i[project_id milestone_id], unique: true
  end
end

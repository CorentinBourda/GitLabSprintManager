class CreateGitlabConfigs < ActiveRecord::Migration[7.1]
  def change
    create_table :gitlab_configs do |t|
      t.string :base_url, null: false, default: "https://gitlab.com"
      t.string :token
      t.string :default_project_id
      t.string :default_project_name

      t.timestamps
    end
  end
end

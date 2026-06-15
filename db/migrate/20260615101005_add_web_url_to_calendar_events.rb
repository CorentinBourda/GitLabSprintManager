class AddWebUrlToCalendarEvents < ActiveRecord::Migration[7.1]
  def change
    add_column :calendar_events, :web_url, :string
  end
end

# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2026_06_15_101005) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "calendar_events", force: :cascade do |t|
    t.string "title", null: false
    t.string "kind", default: "ticket", null: false
    t.datetime "starts_at", null: false
    t.datetime "ends_at", null: false
    t.boolean "all_day", default: false, null: false
    t.string "project_id"
    t.integer "issue_iid"
    t.string "milestone_id"
    t.string "color"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "web_url"
    t.index ["project_id", "issue_iid"], name: "index_calendar_events_on_project_id_and_issue_iid"
    t.index ["starts_at"], name: "index_calendar_events_on_starts_at"
  end

  create_table "gitlab_configs", force: :cascade do |t|
    t.string "base_url", default: "https://gitlab.com", null: false
    t.string "token"
    t.string "default_project_id"
    t.string "default_project_name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "projects", force: :cascade do |t|
    t.string "gitlab_project_id", null: false
    t.string "name", null: false
    t.string "color", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["gitlab_project_id"], name: "index_projects_on_gitlab_project_id", unique: true
  end

  create_table "ticket_statuses", force: :cascade do |t|
    t.string "project_id", null: false
    t.integer "issue_iid", null: false
    t.string "status", default: "not_started", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["project_id", "issue_iid"], name: "index_ticket_statuses_on_project_id_and_issue_iid", unique: true
  end

end

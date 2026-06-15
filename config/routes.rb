Rails.application.routes.draw do
  health_check_routes

  # Reveal health status on /up that returns 200 if the app boots with no exceptions.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api, defaults: { format: :json } do
    resource :settings, only: %i[show update]

    resources :calendar_events, only: %i[index create update destroy]
    resources :ticket_statuses, only: %i[index create]
    resources :projects, only: %i[index create update]
    resources :favorites, only: %i[index create destroy]

    # Read-only GitLab proxy.
    get "gitlab/connection", to: "gitlab#connection"
    get "gitlab/projects",   to: "gitlab#projects"
    get "gitlab/milestones", to: "gitlab#milestones"
    get "gitlab/issues",         to: "gitlab#issues"
    get "gitlab/merge_requests", to: "gitlab#merge_requests"
    get "gitlab/avatar",         to: "gitlab#avatar"
  end

  # Single-page Vue application.
  root "pages#index"
end

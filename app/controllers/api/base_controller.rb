module Api
  class BaseController < ApplicationController
    # Same-origin local JSON API for the SPA. No browser form posts here.
    skip_forgery_protection

    rescue_from GitlabClient::Error do |error|
      render json: { error: error.message }, status: error.status
    end

    rescue_from ActiveRecord::RecordNotFound do
      render json: { error: "Not found" }, status: :not_found
    end

    rescue_from ActiveRecord::RecordInvalid do |error|
      render json: { error: error.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end
end

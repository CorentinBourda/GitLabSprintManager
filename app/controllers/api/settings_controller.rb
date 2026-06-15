module Api
  class SettingsController < BaseController
    def show
      render json: serialize(GitlabConfig.instance)
    end

    def update
      config = GitlabConfig.instance
      config.assign_attributes(settings_params)
      # An empty token field means "keep the existing one".
      config.token = config.token_was if settings_params[:token].blank?
      config.save!
      render json: serialize(config)
    end

    private

    def settings_params
      params.require(:settings).permit(:base_url, :token, :default_project_id, :default_project_name)
    end

    # Never echo the raw token back to the client.
    def serialize(config)
      {
        base_url: config.base_url,
        default_project_id: config.default_project_id,
        default_project_name: config.default_project_name,
        token_set: config.token.present?,
        configured: config.configured?,
      }
    end
  end
end

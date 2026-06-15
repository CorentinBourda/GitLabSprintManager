module Api
  # Read-only proxy in front of the GitLab API. Keeps the token server-side and
  # avoids browser CORS issues.
  class GitlabController < BaseController
    # GET /api/gitlab/connection — validate the configured token.
    def connection
      render json: { user: client.current_user }
    end

    # GET /api/gitlab/projects?search=
    def projects
      render json: client.projects(search: params[:search])
    end

    # GET /api/gitlab/milestones?project_id=&state=
    def milestones
      render json: client.milestones(project_id: project_id, state: params[:state])
    end

    # GET /api/gitlab/issues?project_id=&milestone_id=
    def issues
      render json: client.milestone_issues(project_id: project_id, milestone_id: params.require(:milestone_id))
    end

    # GET /api/gitlab/merge_requests?project_id=&issue_iid=
    def merge_requests
      render json: client.issue_merge_requests(project_id: project_id, issue_iid: params.require(:issue_iid))
    end

    # GET /api/gitlab/avatar?url=… — proxy GitLab-hosted avatars that require
    # authentication so the browser can display them.
    def avatar
      url = params.require(:url)
      allowed_host = URI.parse(GitlabConfig.instance.base_url).host
      unless URI.parse(url).host == allowed_host
        raise GitlabClient::Error.new("Avatar host not allowed", status: 403)
      end

      body, type = client.asset(url)
      expires_in 1.day, public: true
      send_data body, type: type.presence || "image/png", disposition: "inline"
    end

    private

    def client
      @client ||= GitlabClient.new
    end

    def project_id
      params[:project_id].presence || GitlabConfig.instance.default_project_id ||
        raise(GitlabClient::Error.new("No project selected", status: 422))
    end
  end
end

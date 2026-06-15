module Api
  class ProjectsController < BaseController
    def index
      render json: Project.order(:name).map { |p| serialize(p) }
    end

    # Upsert by gitlab_project_id — called when the user starts working on a
    # project (or when backfilling already-scheduled tickets). The name is only
    # set on creation; a color/name the user later chose is never overwritten.
    def create
      gid = create_params[:gitlab_project_id].to_s
      project = Project.find_or_initialize_by(gitlab_project_id: gid)
      project.name = derive_name(gid, create_params[:name]) if project.new_record?
      project.save!
      render json: serialize(project), status: project.previously_new_record? ? :created : :ok
    end

    def update
      project = Project.find(params[:id])
      project.update!(update_params)
      render json: serialize(project)
    end

    private

    def create_params
      params.require(:project).permit(:gitlab_project_id, :name)
    end

    # Project display name = last segment of the path (e.g. "ca-roule-web").
    # Use the client-provided name when given, else ask GitLab for the project.
    def derive_name(gid, provided)
      return last_segment(provided) if provided.present?

      data = GitlabClient.new.project(gid)
      data["path"].presence || last_segment(data["name_with_namespace"]) || "Projet #{gid}"
    rescue GitlabClient::Error
      "Projet #{gid}"
    end

    def last_segment(name)
      name.to_s.split(%r{\s*/\s*}).last.presence
    end

    def update_params
      params.require(:project).permit(:name, :color)
    end

    def serialize(project)
      {
        id: project.id,
        gitlab_project_id: project.gitlab_project_id,
        name: project.name,
        color: project.color,
      }
    end
  end
end

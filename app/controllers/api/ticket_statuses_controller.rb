module Api
  class TicketStatusesController < BaseController
    # GET /api/ticket_statuses?project_id=
    def index
      scope = TicketStatus.all
      scope = scope.where(project_id: params[:project_id].to_s) if params[:project_id].present?
      render json: scope.map { |s| serialize(s) }
    end

    # POST /api/ticket_statuses — upsert one marker.
    def create
      status = TicketStatus.set(
        project_id: status_params[:project_id],
        issue_iid: status_params[:issue_iid],
        status: status_params[:status]
      )
      render json: serialize(status), status: :ok
    end

    private

    def status_params
      params.require(:ticket_status).permit(:project_id, :issue_iid, :status)
    end

    def serialize(status)
      {
        id: status.id,
        project_id: status.project_id,
        issue_iid: status.issue_iid,
        status: status.status,
      }
    end
  end
end

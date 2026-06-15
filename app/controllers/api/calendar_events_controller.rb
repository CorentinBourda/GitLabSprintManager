module Api
  class CalendarEventsController < BaseController
    def index
      events = CalendarEvent.all
      events = events.between(Time.zone.parse(params[:from]), Time.zone.parse(params[:to])) if params[:from] && params[:to]
      render json: events.order(:starts_at).map { |e| serialize(e) }
    end

    def create
      event = CalendarEvent.create!(event_params)
      render json: serialize(event), status: :created
    end

    def update
      event = CalendarEvent.find(params[:id])
      event.update!(event_params)
      render json: serialize(event)
    end

    def destroy
      CalendarEvent.find(params[:id]).destroy!
      head :no_content
    end

    private

    def event_params
      params.require(:calendar_event).permit(
        :title, :kind, :starts_at, :ends_at, :all_day,
        :project_id, :issue_iid, :milestone_id, :color, :notes, :web_url
      )
    end

    def serialize(event)
      {
        id: event.id,
        title: event.title,
        kind: event.kind,
        starts_at: event.starts_at.iso8601,
        ends_at: event.ends_at.iso8601,
        all_day: event.all_day,
        project_id: event.project_id,
        issue_iid: event.issue_iid,
        milestone_id: event.milestone_id,
        color: event.color,
        notes: event.notes,
        web_url: event.web_url,
      }
    end
  end
end

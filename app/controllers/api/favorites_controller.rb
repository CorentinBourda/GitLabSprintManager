module Api
  class FavoritesController < BaseController
    def index
      render json: Favorite.order(:created_at).map { |f| serialize(f) }
    end

    # Upsert by (project_id, milestone_id); keeps the display titles fresh.
    def create
      favorite = Favorite.find_or_initialize_by(
        project_id: favorite_params[:project_id],
        milestone_id: favorite_params[:milestone_id]
      )
      favorite.project_name = favorite_params[:project_name]
      favorite.milestone_title = favorite_params[:milestone_title]
      favorite.save!
      render json: serialize(favorite), status: favorite.previously_new_record? ? :created : :ok
    end

    def destroy
      Favorite.find(params[:id]).destroy!
      head :no_content
    end

    private

    def favorite_params
      params.require(:favorite).permit(:project_id, :project_name, :milestone_id, :milestone_title)
    end

    def serialize(favorite)
      {
        id: favorite.id,
        project_id: favorite.project_id,
        project_name: favorite.project_name,
        milestone_id: favorite.milestone_id,
        milestone_title: favorite.milestone_title,
      }
    end
  end
end

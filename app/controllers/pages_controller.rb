# Serves the single-page Vue application. Everything else is JSON under /api.
class PagesController < ApplicationController
  def index
    render layout: "application"
  end
end

# Thin, READ-ONLY wrapper around the GitLab REST API v4.
#
# Every method here performs a GET. There is intentionally no code path that
# POSTs/PUTs/DELETEs to GitLab — this tool only consumes data.
class GitlabClient
  # Raised for any non-success response or transport error so controllers can
  # surface a clean JSON error to the frontend.
  class Error < StandardError
    attr_reader :status

    def initialize(message, status: 502)
      super(message)
      @status = status
    end
  end

  def initialize(config = GitlabConfig.instance)
    @config = config
    raise Error.new("GitLab is not configured yet", status: 422) unless @config.configured?
  end

  # GET /user — used to validate the token / show who is connected.
  def current_user
    get("user")
  end

  # GET /projects — projects the token's user is a member of.
  def projects(search: nil)
    get("projects", membership: true, simple: true, per_page: 100,
                     order_by: "last_activity_at", search: search.presence)
  end

  # GET /projects/:id/milestones (paginated so every sprint is available)
  def milestones(project_id:, state: nil)
    paginate("projects/#{encode(project_id)}/milestones",
             include_ancestors: true, state: state.presence)
  end

  # GET /projects/:id/milestones/:milestone_id/issues
  def milestone_issues(project_id:, milestone_id:)
    paginate("projects/#{encode(project_id)}/milestones/#{milestone_id}/issues")
  end

  # GET /projects/:id/issues/:issue_iid/related_merge_requests
  # Merge requests that reference the issue (the MRs "associated" to a ticket).
  def issue_merge_requests(project_id:, issue_iid:)
    get("projects/#{encode(project_id)}/issues/#{issue_iid}/related_merge_requests")
  end

  # Fetch a binary asset (e.g. a user avatar) that lives behind GitLab auth.
  # Returns [body, content_type]. The caller is responsible for validating the
  # host before calling this (SSRF guard).
  def asset(url)
    response = Faraday.get(url) { |req| req.headers["PRIVATE-TOKEN"] = config.token }
    raise Error.new("Asset returned #{response.status}", status: 404) unless response.success?

    [response.body, response.headers["content-type"]]
  rescue Faraday::Error => e
    raise Error.new("Could not fetch asset: #{e.message}", status: 502)
  end

  private

  attr_reader :config

  def connection
    # Trailing slash is required so that relative paths (e.g. "user") resolve
    # under /api/v4/ instead of replacing it.
    @connection ||= Faraday.new(url: "#{config.api_base}/") do |f|
      f.headers["PRIVATE-TOKEN"] = config.token
      f.options.timeout = 20
      f.options.open_timeout = 8
    end
  end

  def get(path, params = {})
    response = connection.get(path, params.compact)
    handle(response)
  rescue Faraday::Error => e
    raise Error.new("Could not reach GitLab: #{e.message}")
  end

  # Follow GitLab's `x-next-page` pagination header so we return every issue.
  def paginate(path, params = {})
    results = []
    page = 1
    loop do
      response = connection.get(path, params.merge(per_page: 100, page: page))
      results.concat(handle(response))
      next_page = response.headers["x-next-page"].to_s
      break if next_page.empty?

      page = next_page.to_i
    end
    results
  end

  def handle(response)
    return parse(response.body) if response.success?

    message =
      case response.status
      when 401 then "Invalid or missing GitLab token"
      when 403 then "Token lacks permission for this resource"
      when 404 then "Resource not found on GitLab"
      else "GitLab returned #{response.status}"
      end
    raise Error.new(message, status: response.status == 401 ? 401 : 502)
  end

  def parse(body)
    return [] if body.blank?

    JSON.parse(body)
  rescue JSON::ParserError
    raise Error.new("Unexpected response from GitLab")
  end

  def encode(project_id)
    # Numeric ids pass through; "group/project" paths must be URL-encoded.
    project_id.to_s.match?(/\A\d+\z/) ? project_id : CGI.escape(project_id.to_s)
  end
end

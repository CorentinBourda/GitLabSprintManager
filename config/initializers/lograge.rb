require 'lograge/sql/extension'

Rails.application.configure do
  PARAMS_EXCEPTIONS ||= %w[controller action format id].freeze
  ENV_NAMES ||= %w[CONTENT_TYPE HTTP_ACCEPT HTTP_AUTHORIZATION].freeze

  # Enable lograge
  config.lograge.enabled = !Rails.env.development? && !Rails.env.test?

  # Format as JSON object
  config.lograge.formatter = Lograge::Formatters::Json.new

  # Ignore those actions
  config.lograge.ignore_actions = %w[
    HealthCheck::HealthCheckController#index
    Rails::HealthController#show
  ]

  # To keep sql default log in not prod mode
  config.lograge_sql.keep_default_active_record_log = Rails.env.development? || Rails.env.test?

  config.lograge_sql.extract_event = Proc.new do |event|
    { name: event.payload[:name], duration: event.duration.to_f.round(2), sql: event.payload[:sql] }
  end

  # Format the array of extracted events
  config.lograge_sql.formatter = Proc.new do |sql_queries|
    sql_queries
  end

  # Disables log coloration
  config.colorize_logging = Rails.env.development? || Rails.env.test?

  # Add some data to the log
  config.lograge.custom_payload do |controller|
    response = controller.response
    user = begin
             controller.send(:current_user)
           rescue StandardError
             nil
           end

    # If response is JSON, we want to get it as Hash
    # Datadog can handle a maximum of 256k bytes, so to not truncat the log, we limit response size to 64k
    parsed_response = if response.body.present? && response.headers['Content-Type']&.match(%r{application/json}) && response.body.size < 64_000
                        begin
                          JSON.parse(response.body)
                        rescue StandardError
                          nil
                        end
                      end

    # Get all the parameters (permitted or not) as a Hash
    params = controller.params.except(*PARAMS_EXCEPTIONS).to_unsafe_h

    {
      request_id: controller.request.request_id,
      time:       Time.zone.now.iso8601,
      headers:    controller.request.headers.env.select { |k, _| k =~ /^HTTP_X_/ || ENV_NAMES.include?(k) },
      params:     params,
      response:   parsed_response,
      user:       DatadogUserFormatter.call(user)
    }
  end

  # Configure logging of exceptions to the correct fields
  config.lograge.custom_options = Lograge::Datadog::Error::Tracking
end

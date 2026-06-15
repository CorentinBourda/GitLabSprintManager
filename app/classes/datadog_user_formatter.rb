# frozen_string_literal: true

class DatadogUserFormatter

  def self.call(user)
    return if user.nil?

    {
      id:       user.id,
      username: user.id
    }
  end

end

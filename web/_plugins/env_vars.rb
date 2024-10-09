# Plugin to add environment variables to the `site` object in Liquid templates
module Jekyll
    class EnvironmentVariablesGenerator < Generator
      def generate(site)
        puts "Custom Environment Plugin Loaded"  # Add this line for debugging
        site.config['cf_pages_branch'] = ENV['CF_PAGES_BRANCH'] || 'local'
        # Add other environment variables to `site.config` here...
      end
    end
  end

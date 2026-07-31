Pod::Spec.new do |s|
  s.name             = 'FormVideoNormalizer'
  s.version          = '1.0.0'
  s.summary          = 'Exports full-length exercise videos with physical upright orientation.'
  s.description      = s.summary
  s.license          = { :type => 'MIT' }
  s.author           = 'Formie'
  s.homepage         = 'https://formie.app'
  s.platforms        = { :ios => '15.1' }
  s.source           = { :git => 'https://example.invalid/form-video-normalizer.git' }
  s.static_framework = true
  s.swift_version    = '5.9'
  s.source_files     = '*.swift'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end

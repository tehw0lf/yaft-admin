export interface FeatureTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  keyTemplate: string;
  value: string;
  tags: string[];
  activeAt?: string;
  disabledAt?: string;
  isBuiltIn: boolean;
  createdAt: Date;
  usageCount: number;
  variables?: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  description: string;
  defaultValue?: string | number | boolean;
  required: boolean;
  options?: string[]; // For select type
  placeholder?: string;
  pattern?: string; // For validation
}

export interface TemplateCategory {
  name: string;
  description: string;
  icon: string;
  templates: FeatureTemplate[];
}

export interface TemplateUsage {
  templateId: string;
  featureKey: string;
  createdAt: Date;
  variables?: { [key: string]: string | number | boolean };
}

// Built-in template definitions
export const BUILT_IN_TEMPLATES: FeatureTemplate[] = [
  {
    id: 'basic-toggle',
    name: 'Basic Toggle',
    description: 'Simple on/off feature toggle',
    category: 'Basic',
    icon: 'toggle_on',
    keyTemplate: '{{feature_name}}',
    value: 'false',
    tags: ['basic'],
    isBuiltIn: true,
    createdAt: new Date(),
    usageCount: 0,
    variables: [
      {
        name: 'feature_name',
        type: 'text',
        description: 'Name of the feature',
        required: true,
        placeholder: 'my-feature',
        pattern: '^[a-z0-9-_]+$'
      }
    ]
  },
  {
    id: 'scheduled-release',
    name: 'Scheduled Release',
    description: 'Feature that activates at a specific date and time',
    category: 'Scheduling',
    icon: 'schedule',
    keyTemplate: '{{feature_name}}_{{release_version}}',
    value: 'false',
    tags: ['scheduled', 'release'],
    isBuiltIn: true,
    createdAt: new Date(),
    usageCount: 0,
    variables: [
      {
        name: 'feature_name',
        type: 'text',
        description: 'Name of the feature',
        required: true,
        placeholder: 'new-dashboard'
      },
      {
        name: 'release_version',
        type: 'text',
        description: 'Release version',
        required: true,
        placeholder: 'v2.1'
      },
      {
        name: 'activation_date',
        type: 'date',
        description: 'When to activate the feature',
        required: true
      }
    ]
  },
  {
    id: 'ab-test',
    name: 'A/B Test Feature',
    description: 'Feature toggle for A/B testing experiments',
    category: 'Experimentation',
    icon: 'science',
    keyTemplate: 'ab_test_{{experiment_name}}',
    value: 'false',
    tags: ['ab-test', 'experiment'],
    isBuiltIn: true,
    createdAt: new Date(),
    usageCount: 0,
    variables: [
      {
        name: 'experiment_name',
        type: 'text',
        description: 'Name of the experiment',
        required: true,
        placeholder: 'checkout-flow'
      },
      {
        name: 'test_percentage',
        type: 'number',
        description: 'Percentage of users in test',
        defaultValue: 50,
        required: true
      }
    ]
  },
  {
    id: 'beta-feature',
    name: 'Beta Feature',
    description: 'Feature available only to beta users',
    category: 'Beta',
    icon: 'preview',
    keyTemplate: 'beta_{{feature_name}}',
    value: 'false',
    tags: ['beta', 'testing'],
    isBuiltIn: true,
    createdAt: new Date(),
    usageCount: 0,
    variables: [
      {
        name: 'feature_name',
        type: 'text',
        description: 'Name of the beta feature',
        required: true,
        placeholder: 'new-editor'
      },
      {
        name: 'beta_group',
        type: 'select',
        description: 'Beta group',
        required: true,
        options: ['internal', 'closed-beta', 'open-beta'],
        defaultValue: 'closed-beta'
      }
    ]
  },
  {
    id: 'maintenance-mode',
    name: 'Maintenance Mode',
    description: 'Toggle for maintenance mode activation',
    category: 'Operations',
    icon: 'build',
    keyTemplate: 'maintenance_{{service_name}}',
    value: 'false',
    tags: ['maintenance', 'operations'],
    isBuiltIn: true,
    createdAt: new Date(),
    usageCount: 0,
    variables: [
      {
        name: 'service_name',
        type: 'select',
        description: 'Service to put in maintenance',
        required: true,
        options: ['api', 'frontend', 'database', 'all'],
        defaultValue: 'all'
      },
      {
        name: 'maintenance_start',
        type: 'date',
        description: 'Maintenance start time',
        required: false
      },
      {
        name: 'maintenance_end',
        type: 'date',
        description: 'Expected maintenance end time',
        required: false
      }
    ]
  },
  {
    id: 'gradual-rollout',
    name: 'Gradual Rollout',
    description: 'Feature that rolls out gradually to users',
    category: 'Rollout',
    icon: 'trending_up',
    keyTemplate: 'rollout_{{feature_name}}',
    value: 'false',
    tags: ['rollout', 'gradual'],
    isBuiltIn: true,
    createdAt: new Date(),
    usageCount: 0,
    variables: [
      {
        name: 'feature_name',
        type: 'text',
        description: 'Name of the feature',
        required: true,
        placeholder: 'new-checkout'
      },
      {
        name: 'initial_percentage',
        type: 'number',
        description: 'Initial rollout percentage',
        defaultValue: 5,
        required: true
      },
      {
        name: 'rollout_duration',
        type: 'number',
        description: 'Rollout duration in days',
        defaultValue: 7,
        required: true
      }
    ]
  }
];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    name: 'Basic',
    description: 'Simple feature toggles for everyday use',
    icon: 'toggle_on',
    templates: BUILT_IN_TEMPLATES.filter(t => t.category === 'Basic')
  },
  {
    name: 'Scheduling',
    description: 'Time-based feature activation and scheduling',
    icon: 'schedule',
    templates: BUILT_IN_TEMPLATES.filter(t => t.category === 'Scheduling')
  },
  {
    name: 'Experimentation',
    description: 'A/B testing and experimental features',
    icon: 'science',
    templates: BUILT_IN_TEMPLATES.filter(t => t.category === 'Experimentation')
  },
  {
    name: 'Beta',
    description: 'Beta and preview features',
    icon: 'preview',
    templates: BUILT_IN_TEMPLATES.filter(t => t.category === 'Beta')
  },
  {
    name: 'Operations',
    description: 'Operational and maintenance toggles',
    icon: 'build',
    templates: BUILT_IN_TEMPLATES.filter(t => t.category === 'Operations')
  },
  {
    name: 'Rollout',
    description: 'Gradual rollout and deployment features',
    icon: 'trending_up',
    templates: BUILT_IN_TEMPLATES.filter(t => t.category === 'Rollout')
  }
];
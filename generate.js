// generate.js
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class NestJSGenerator {
  constructor() {
    this.config = {
      templatesDir: './templates',
      outputDir: './src/modules',
      templates: {
        module: { extension: 'module.ts', required: true },
        controller: { extension: 'controller.ts', required: true },
        service: { extension: 'service.ts', required: true },
        'create-dto': {
          extension: 'dto.ts',
          required: false,
          outputPath: 'dto',
          filename: 'create-{{singularName}}.dto.ts',
        },
        'update-dto': {
          extension: 'dto.ts',
          required: false,
          outputPath: 'dto',
          filename: 'update-{{singularName}}.dto.ts',
        },
        schema: {
          extension: 'schema.ts',
          required: false,
          outputPath: 'schema',
          filename: '{{singularName}}.schema.ts',
        },
      },
      exclusions: {
        'create-dto': ['auth', 'payments'],
        'update-dto': ['auth', 'payments'],
        schema: ['auth', 'sidebar'],
      },
    };
  }

  // Utility functions
  toPascalCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  toCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  toKebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  toSnakeCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  }

  // Convert plural to singular (basic implementation)
  toSingular(str) {
    // Handle common plural patterns
    if (str.endsWith('ies')) {
      return str.slice(0, -3) + 'y'; // categories -> category
    }
    if (str.endsWith('ves')) {
      return str.slice(0, -3) + 'f'; // leaves -> leaf
    }
    if (str.endsWith('es') && (str.endsWith('ches') || str.endsWith('shes') || str.endsWith('xes'))) {
      return str.slice(0, -2); // boxes -> box
    }
    if (str.endsWith('s') && !str.endsWith('ss')) {
      return str.slice(0, -1); // users -> user
    }
    return str; // already singular or irregular
  }

  // Check if a module should be excluded for a specific template
  shouldExclude(moduleName, templateName) {
    const excludeList = this.config.exclusions[templateName];
    return excludeList && excludeList.includes(moduleName);
  }

  // Get template content and replace placeholders
  processTemplate(templateName, moduleName) {
    const templatePath = path.join(this.config.templatesDir, `${templateName}.stub`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    let content = fs.readFileSync(templatePath, 'utf-8');

    // Get singular form
    const singularName = this.toSingular(moduleName);

    // Replace all possible naming conventions
    const replacements = {
      '{{moduleName}}': moduleName,
      '{{ModuleName}}': this.toPascalCase(moduleName),
      '{{module_name}}': this.toSnakeCase(moduleName),
      '{{module-name}}': this.toKebabCase(moduleName),
      '{{camelModuleName}}': this.toCamelCase(moduleName),
      '{{MODULE_NAME}}': moduleName.toUpperCase(),
      // Singular versions
      '{{singularName}}': singularName,
      '{{SingularName}}': this.toPascalCase(singularName),
      '{{singular_name}}': this.toSnakeCase(singularName),
      '{{singular-name}}': this.toKebabCase(singularName),
      '{{camelSingularName}}': this.toCamelCase(singularName),
      '{{SINGULAR_NAME}}': singularName.toUpperCase(),
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      content = content.replace(new RegExp(placeholder, 'g'), value);
    });

    return content;
  }

  // Generate a single file
  generateFile(moduleName, templateName, templateConfig) {
    if (this.shouldExclude(moduleName, templateName)) {
      console.log(`  - Skipping ${templateName} (excluded for ${moduleName})`);
      return;
    }

    try {
      const content = this.processTemplate(templateName, moduleName);

      // Determine an output path
      let outputPath;
      if (templateConfig.outputPath) {
        outputPath = path.join(
          this.config.outputDir,
          moduleName,
          templateConfig.outputPath,
        );
      } else {
        outputPath = path.join(this.config.outputDir, moduleName);
      }

      // Ensure directory exists
      fs.mkdirSync(outputPath, { recursive: true });

      // Determine filename
      let filename;
      if (templateConfig.filename) {
        const singularName = this.toSingular(moduleName);
        filename = templateConfig.filename
          .replace(/{{moduleName}}/g, moduleName)
          .replace(/{{singularName}}/g, singularName);
      } else {
        filename = `${moduleName}.${templateConfig.extension}`;
      }

      const fullPath = path.join(outputPath, filename);

      // Check if a file already exists
      if (fs.existsSync(fullPath)) {
        console.log(`  - Skipping ${templateName} (${fullPath} already exists)`);
        return;
      }

      // Write file
      fs.writeFileSync(fullPath, content, 'utf-8');
      console.log(`  - Generated: ${fullPath}`);

    } catch (error) {
      console.error(`  - Error generating ${templateName}: ${error.message}`);
    }
  }

  // Generate all files for a module
  generateModule(moduleName) {
    console.log(`\nGenerating module: ${moduleName}`);

    Object.entries(this.config.templates).forEach(([templateName, templateConfig]) => {
      this.generateFile(moduleName, templateName, templateConfig);
    });
  }

  // Generate multiple modules
  generateModules(moduleNames) {
    if (!Array.isArray(moduleNames)) {
      moduleNames = [moduleNames];
    }

    // Validate templates directory
    if (!fs.existsSync(this.config.templatesDir)) {
      console.error(`Templates directory not found: ${this.config.templatesDir}`);
      process.exit(1);
    }

    moduleNames.forEach(moduleName => {
      this.generateModule(moduleName);
    });
  }

  // Load configuration from a file if exists
  loadConfig(configPath = './generator.config.js') {
    if (fs.existsSync(configPath)) {
      try {
        const userConfig = require(path.resolve(configPath));
        this.config = { ...this.config, ...userConfig };
        console.log(`Loaded configuration from: ${configPath}`);
      } catch (error) {
        console.warn(`Warning: Could not load config file: ${error.message}`);
      }
    }
  }

  // Initialize templates directory with default stubs
  initTemplates() {
    const templatesDir = this.config.templatesDir;

    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
      console.log(`Created templates directory: ${templatesDir}`);
    }

    const defaultTemplates = {
      'module.stub': `import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { {{ModuleName}}Controller } from './{{moduleName}}.controller';
import { {{ModuleName}}Service } from './{{moduleName}}.service';
import { {{SingularName}}, {{SingularName}}Schema } from './schema/{{singularName}}.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: {{SingularName}}.name, schema: {{SingularName}}Schema }
    ]),
  ],
  controllers: [{{ModuleName}}Controller],
  providers: [{{ModuleName}}Service],
  exports: [{{ModuleName}}Service],
})
export class {{ModuleName}}Module {}`,

      'controller.stub': `import { 
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { {{ModuleName}}Service } from './{{moduleName}}.service';
import { Create{{SingularName}}Dto } from './dto/create-{{singularName}}.dto';
import { Update{{SingularName}}Dto } from './dto/update-{{singularName}}.dto';

@Controller('{{module-name}}')
export class {{ModuleName}}Controller {
  constructor(private readonly {{camelModuleName}}Service: {{ModuleName}}Service) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() create{{SingularName}}Dto: Create{{SingularName}}Dto) {
    return this.{{camelModuleName}}Service.create(create{{SingularName}}Dto);
  }

  @Get()
  findAll() {
    return this.{{camelModuleName}}Service.findAll();
  }

  @Get('count')
  count(@Query('search') search?: string) {
    return this.{{camelModuleName}}Service.count(search);
  }

  @Get('search')
  searchByName(@Query('name') name: string) {
    return this.{{camelModuleName}}Service.findByName(name);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.{{camelModuleName}}Service.findOne(id);
  }

  @Get(':id/exists')
  exists(@Param('id') id: string) {
    return this.{{camelModuleName}}Service.exists(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() update{{SingularName}}Dto: Update{{SingularName}}Dto,
  ) {
    return this.{{camelModuleName}}Service.update(id, update{{SingularName}}Dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.{{camelModuleName}}Service.remove(id);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  removeMany(@Body('ids') ids: string[]) {
    return this.{{camelModuleName}}Service.removeMany(ids);
  }
}`,

      'service.stub': `import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Create{{SingularName}}Dto } from './dto/create-{{singularName}}.dto';
import { Update{{SingularName}}Dto } from './dto/update-{{singularName}}.dto';
import { {{SingularName}}, {{SingularName}}Document } from './schema/{{singularName}}.schema';

@Injectable()
export class {{ModuleName}}Service {
  constructor(
    @InjectModel({{SingularName}}.name) 
    private readonly {{camelSingularName}}Model: Model<{{SingularName}}Document>,
  ) {}
  
  async create(create{{SingularName}}Dto: Create{{SingularName}}Dto): Promise<{{SingularName}}> {
    try {
      const created{{SingularName}} = new this.{{camelSingularName}}Model(create{{SingularName}}Dto);
      return await created{{SingularName}}.save();
    } catch (error) {
      throw new BadRequestException(\`Failed to create {{singularName}}: \${error.message}\`);
    }
  }
  
  async findAll(): Promise<{{SingularName}}[]> {
    return this.{{camelSingularName}}Model.find().lean().exec();
  }

  async findOne(id: string): Promise<{{SingularName}}> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid ID format');
    }

    const {{camelSingularName}} = await this.{{camelSingularName}}Model.findById(id).exec();
    if (!{{camelSingularName}}) {
      throw new NotFoundException(\`{{SingularName}} with ID \${id} not found\`);
    }
    return {{camelSingularName}};
  }

  async findByName(name: string): Promise<{{SingularName}}[]> {
    return this.{{camelSingularName}}Model
      .find({ name: { $regex: name, $options: 'i' } })
      .exec();
  }

  async update(id: string, update{{SingularName}}Dto: Update{{SingularName}}Dto): Promise<{{SingularName}}> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid ID format');
    }

    const updated{{SingularName}} = await this.{{camelSingularName}}Model
      .findByIdAndUpdate(id, update{{SingularName}}Dto, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!updated{{SingularName}}) {
      throw new NotFoundException(\`{{SingularName}} with ID \${id} not found\`);
    }

    return updated{{SingularName}};
  }

  async remove(id: string): Promise<{ message: string; deletedId: string }> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid ID format');
    }

    const deleted{{SingularName}} = await this.{{camelSingularName}}Model
      .findByIdAndDelete(id)
      .exec();

    if (!deleted{{SingularName}}) {
      throw new NotFoundException(\`{{SingularName}} with ID \${id} not found\`);
    }

    return {
      message: \`{{SingularName}} with ID \${id} has been successfully deleted\`,
      deletedId: id,
    };
  }

  async removeMany(ids: string[]): Promise<{ message: string; deletedCount: number }> {
    const validIds = ids.filter(id => id.match(/^[0-9a-fA-F]{24}$/));
    
    if (validIds.length !== ids.length) {
      throw new BadRequestException('Some IDs have invalid format');
    }

    const result = await this.{{camelSingularName}}Model
      .deleteMany({ _id: { $in: validIds } })
      .exec();

    return {
      message: \`Successfully deleted \${result.deletedCount} {{singularName}}(s)\`,
      deletedCount: result.deletedCount,
    };
  }

  async count(search?: string): Promise<number> {
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ],
      };
    }
    return this.{{camelSingularName}}Model.countDocuments(query).exec();
  }

  async exists(id: string): Promise<boolean> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return false;
    }
    const count = await this.{{camelSingularName}}Model.countDocuments({ _id: id }).exec();
    return count > 0;
  }
}`,

      'create-dto.stub': `import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class Create{{SingularName}}Dto {
  @IsString()
  @IsNotEmpty()
  name: string;

  // Add more properties as needed
}`,

      'update-dto.stub': `import { PartialType } from '@nestjs/mapped-types';
import { Create{{SingularName}}Dto } from './create-{{singularName}}.dto';

export class Update{{SingularName}}Dto extends PartialType(Create{{SingularName}}Dto) {}`,

      'schema.stub': `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type {{SingularName}}Document = {{SingularName}} & Document;

@Schema({
  timestamps: true,
  collection: '{{module-name}}',
})
export class {{SingularName}} {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
    unique: true,
  })
  name: string;

  // Add more fields as needed
}

export const {{SingularName}}Schema = SchemaFactory.createForClass({{SingularName}});`,
    };

    Object.entries(defaultTemplates).forEach(([filename, content]) => {
      const filePath = path.join(templatesDir, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content);
        console.log(`Created template: ${filePath}`);
      }
    });
  }

  // Show help
  showHelp() {
    console.log(`
NestJS Module Generator

Usage:
  node generate.js <command> [options]

Commands:
  init                    Initialize templates directory with default stubs
  generate <modules...>   Generate modules (space-separated)
  batch                   Generate all modules from predefined list
  help                    Show this help message

Examples:
  node generate.js init
  node generate.js generate users
  node generate.js generate users products orders
  node generate.js batch

Configuration:
  Create a 'generator.config.js' file to customize templates, exclusions, and paths.
    `);
  }
}

// CLI Interface
function main() {
  const generator = new NestJSGenerator();
  const args = process.argv.slice(2);
  const command = args[0];

  // Load configuration if exists
  generator.loadConfig();

  switch (command) {
    case 'init':
      generator.initTemplates();
      break;

    case 'generate':
      if (args.length < 2) {
        console.error('Error: Please provide module name(s)');
        generator.showHelp();
        process.exit(1);
      }
      generator.generateModules(args.slice(1));
      break;

    case 'batch':
      // Use batchModules from config if available, otherwise use default
      const modules = generator.config.batchModules || [
        'users',
        'user_preferences',
        'articles',
        'checklists',
        'categories',
        'tags',
        'comments',
        'questions',
        'answers',
        'testimonials',
        // 'roles',
        // 'permissions',
      ];
      generator.generateModules(modules);
      break;

    case 'help':
    default:
      generator.showHelp();
      break;
  }
}

// Export for use as a module
module.exports = NestJSGenerator;

// Run if called directly
if (require.main === module) {
  main();
}
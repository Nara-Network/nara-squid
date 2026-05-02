import { logsProcessorGenerator, logsProcessorParser } from '../common/generate';
import configurator from './config';

const processor = logsProcessorGenerator(configurator);

const { db, parser } = logsProcessorParser(configurator);
processor.run(db, parser);
